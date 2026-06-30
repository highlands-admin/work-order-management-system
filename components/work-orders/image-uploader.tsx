'use client'

import {
  RiCloseLine,
  RiErrorWarningLine,
  RiImageAddLine,
  RiLoader4Line,
} from '@remixicon/react'
import imageCompression from 'browser-image-compression'
import { useRef, useState } from 'react'

import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENTS_PER_WORK_ORDER,
  type AllowedImageType,
  type AttachmentMetadata,
} from '@/lib/schemas/attachment'
import { cn } from '@/lib/utils'

// An attachment already stored on a work order, passed in when editing.
export type ExistingAttachment = {
  id: string
  url: string
  name: string | null
}

// A file the user added in this session, tracked through its upload lifecycle.
type UploadItem = {
  localId: string
  name: string
  previewUrl: string
  status: 'uploading' | 'done' | 'error'
  error?: string
  // Set as soon as the object key is known (after presigning), so a removal can
  // delete the object even while the upload is still in flight.
  key?: string
  meta?: AttachmentMetadata
  controller: AbortController
}

function isAllowedType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)
}

// Resize and re-encode in the browser. The canvas re-encode drops EXIF
// metadata (including GPS), and the smaller output keeps uploads well under the
// size cap.
async function compressImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: isAllowedType(file.type) ? file.type : 'image/jpeg',
  })
  // imageCompression returns a Blob; wrap it back into a File so the name and
  // type travel with it.
  return new File([compressed], file.name, {
    type: isAllowedType(compressed.type) ? compressed.type : 'image/jpeg',
  })
}

export function ImageUploader({
  existing = [],
}: {
  existing?: ExistingAttachment[]
}) {
  const [items, setItems] = useState<UploadItem[]>([])
  // Existing attachments the user chose to remove. Their IDs are submitted so
  // the update action deletes the rows and the underlying objects.
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const keptExisting = existing.filter((a) => !removedIds.includes(a.id))
  const liveCount = keptExisting.length + items.filter((i) => i.status !== 'error').length
  const remaining = MAX_ATTACHMENTS_PER_WORK_ORDER - liveCount

  function patchItem(localId: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it))
    )
  }

  async function uploadOne(
    file: File,
    localId: string,
    controller: AbortController
  ) {
    try {
      const prepared = await compressImage(file)
      const contentType = prepared.type as AllowedImageType

      const presignRes = await fetch(
        '/api/work-orders/attachments/presign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: prepared.name,
            contentType,
            size: prepared.size,
          }),
          signal: controller.signal,
        }
      )
      if (!presignRes.ok) {
        const data = (await presignRes.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? 'Could not prepare the upload.')
      }
      const { key, uploadUrl } = (await presignRes.json()) as {
        key: string
        uploadUrl: string
      }
      // Record the key now so a removal mid-upload can still clean up the object.
      patchItem(localId, { key })

      // Upload straight to MinIO. The Content-Type must match what was signed.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: prepared,
        signal: controller.signal,
      })
      if (!putRes.ok) {
        throw new Error('Upload failed. Check your connection and try again.')
      }

      patchItem(localId, {
        status: 'done',
        meta: {
          key,
          contentType,
          size: prepared.size,
          name: prepared.name,
        },
      })
    } catch (error) {
      // A removal aborts the request; the item is already gone, so stay quiet.
      if (controller.signal.aborted) return
      patchItem(localId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed.',
      })
    }
  }

  // Best-effort removal of an uploaded-but-unsaved object from the bucket. A
  // failure leaves an orphan object, not a broken UI, so it only logs.
  async function deleteUploadedObject(key: string) {
    try {
      await fetch(
        `/api/work-orders/attachments?key=${encodeURIComponent(key)}`,
        { method: 'DELETE' }
      )
    } catch (error) {
      console.error('Failed to delete uploaded image', error)
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList)
      .filter((f) => isAllowedType(f.type))
      .slice(0, Math.max(0, remaining))

    for (const file of files) {
      const localId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      const controller = new AbortController()
      setItems((prev) => [
        ...prev,
        { localId, name: file.name, previewUrl, status: 'uploading', controller },
      ])
      void uploadOne(file, localId, controller)
    }

    // Reset the input so selecting the same file again re-triggers onChange.
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeItem(localId: string) {
    const target = items.find((it) => it.localId === localId)
    if (target) {
      // Cancel an in-flight upload, free the preview, and delete the object if
      // it already reached the bucket.
      target.controller.abort()
      URL.revokeObjectURL(target.previewUrl)
      const key = target.meta?.key ?? target.key
      if (key) void deleteUploadedObject(key)
    }
    setItems((prev) => prev.filter((it) => it.localId !== localId))
  }

  function removeExisting(id: string) {
    setRemovedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden fields the create/update action reads. Only fully uploaded
          files contribute an attachment; removed existing IDs are submitted so
          the server can detach and delete them. */}
      {items
        .filter((it) => it.status === 'done' && it.meta)
        .map((it) => (
          <input
            key={it.localId}
            type="hidden"
            name="attachment"
            value={JSON.stringify(it.meta)}
          />
        ))}
      {removedIds.map((id) => (
        <input key={id} type="hidden" name="removedAttachment" value={id} />
      ))}

      {(keptExisting.length > 0 || items.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {keptExisting.map((a) => (
            <Thumbnail
              key={a.id}
              src={a.url}
              label={a.name ?? 'Attachment'}
              onRemove={() => removeExisting(a.id)}
            />
          ))}
          {items.map((it) => (
            <Thumbnail
              key={it.localId}
              src={it.previewUrl}
              label={it.name}
              status={it.status}
              error={it.error}
              onRemove={() => removeItem(it.localId)}
            />
          ))}
        </ul>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={remaining <= 0}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-muted/20 px-4 py-8 text-center transition-colors',
            remaining <= 0
              ? 'cursor-not-allowed opacity-60'
              : 'hover:border-foreground/30 hover:bg-muted/40'
          )}
        >
          <RiImageAddLine
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            {remaining <= 0
              ? `Maximum of ${MAX_ATTACHMENTS_PER_WORK_ORDER} images reached`
              : 'Add images'}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            JPEG, PNG, or WebP · Up to {MAX_ATTACHMENTS_PER_WORK_ORDER} per work
            order
          </span>
        </button>
      </div>
    </div>
  )
}

function Thumbnail({
  src,
  label,
  status = 'done',
  error,
  onRemove,
}: {
  src: string
  label: string
  status?: UploadItem['status']
  error?: string
  onRemove: () => void
}) {
  return (
    <li className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10">
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned URLs
          are short-lived and already compressed, so Next image optimization
          adds cost without benefit here. */}
      <img
        src={src}
        alt={label}
        className={cn(
          'h-full w-full object-cover',
          status !== 'done' && 'opacity-50'
        )}
      />

      {status === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <RiLoader4Line
            className="size-6 animate-spin text-foreground"
            aria-label="Uploading"
          />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/15 p-2 text-center">
          <RiErrorWarningLine
            className="size-5 text-destructive"
            aria-hidden="true"
          />
          <span className="text-xs text-destructive">{error ?? 'Failed'}</span>
        </div>
      )}

      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
      >
        <RiCloseLine className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}
