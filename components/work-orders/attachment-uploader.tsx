'use client'

import {
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiUploadCloud2Line,
} from '@remixicon/react'
import imageCompression from 'browser-image-compression'
import { useRef, useState } from 'react'

import { FileIcon } from '@/components/work-orders/file-icon'
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_WORK_ORDER,
  MAX_ATTACHMENT_BYTES,
  attachmentTypeForFilename,
  isImageType,
  type AllowedAttachmentType,
  type AttachmentMetadata,
} from '@/lib/schemas/attachment'
import { cn } from '@/lib/utils'

// An attachment already stored on a work order, passed in when editing.
export type ExistingAttachment = {
  id: string
  url: string
  name: string | null
  contentType: string
}

// A file the user added in this session, tracked through its upload lifecycle.
type UploadItem = {
  localId: string
  name: string
  contentType: AllowedAttachmentType
  isImage: boolean
  // Object URL for the image preview; absent for non-image files.
  previewUrl?: string
  status: 'uploading' | 'done' | 'error'
  error?: string
  // Set as soon as the object key is known (after presigning), so a removal can
  // delete the object even while the upload is still in flight.
  key?: string
  meta?: AttachmentMetadata
  controller: AbortController
}

const MAX_MB = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))

function extensionLabel(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1].toUpperCase() : 'FILE'
}

// Resize and re-encode an image in the browser. The canvas re-encode drops EXIF
// metadata (including GPS), and the smaller output keeps uploads well under the
// size cap. Non-image files are uploaded unchanged.
async function compressImage(
  file: File,
  contentType: AllowedAttachmentType
): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: contentType,
  })
  return new File([compressed], file.name, { type: contentType })
}

export function AttachmentUploader({
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
  const liveCount =
    keptExisting.length + items.filter((i) => i.status !== 'error').length
  const remaining = MAX_ATTACHMENTS_PER_WORK_ORDER - liveCount

  function patchItem(localId: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it))
    )
  }

  async function uploadOne(
    file: File,
    localId: string,
    contentType: AllowedAttachmentType,
    controller: AbortController
  ) {
    try {
      const prepared = isImageType(contentType)
        ? await compressImage(file, contentType)
        : file

      if (prepared.size > MAX_ATTACHMENT_BYTES) {
        throw new Error(`File is too large (max ${MAX_MB} MB).`)
      }

      const presignRes = await fetch(
        '/api/work-orders/attachments/presign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
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
        meta: { key, contentType, size: prepared.size, name: file.name },
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
      console.error('Failed to delete uploaded attachment', error)
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const candidates = Array.from(fileList)
      .map((file) => ({ file, contentType: attachmentTypeForFilename(file.name) }))
      .filter(
        (c): c is { file: File; contentType: AllowedAttachmentType } =>
          c.contentType !== null
      )
      .slice(0, Math.max(0, remaining))

    for (const { file, contentType } of candidates) {
      const localId = crypto.randomUUID()
      const isImage = isImageType(contentType)
      const controller = new AbortController()
      setItems((prev) => [
        ...prev,
        {
          localId,
          name: file.name,
          contentType,
          isImage,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          status: 'uploading',
          controller,
        },
      ])
      void uploadOne(file, localId, contentType, controller)
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
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl)
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
            <Tile
              key={a.id}
              name={a.name ?? 'Attachment'}
              contentType={a.contentType}
              previewUrl={isImageType(a.contentType) ? a.url : undefined}
              onRemove={() => removeExisting(a.id)}
            />
          ))}
          {items.map((it) => (
            <Tile
              key={it.localId}
              name={it.name}
              contentType={it.contentType}
              previewUrl={it.previewUrl}
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
          accept={ATTACHMENT_ACCEPT}
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
          <RiUploadCloud2Line
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            {remaining <= 0
              ? `Maximum of ${MAX_ATTACHMENTS_PER_WORK_ORDER} files reached`
              : 'Add files'}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            Images, PDF, Word, Excel, or PowerPoint · Up to {MAX_MB} MB each
          </span>
        </button>
      </div>
    </div>
  )
}

function Tile({
  name,
  contentType,
  previewUrl,
  status = 'done',
  error,
  onRemove,
}: {
  name: string
  contentType: string
  previewUrl?: string
  status?: UploadItem['status']
  error?: string
  onRemove: () => void
}) {
  return (
    <li className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10">
      {previewUrl ? (
        // Presigned and object URLs are short-lived and already compressed, so
        // Next image optimization adds cost without benefit here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={name}
          className={cn(
            'h-full w-full object-cover',
            status !== 'done' && 'opacity-50'
          )}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 p-3 text-center',
            status !== 'done' && 'opacity-50'
          )}
        >
          <FileIcon
            contentType={contentType}
            className="size-8 text-muted-foreground"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {extensionLabel(name)}
          </span>
          <span className="line-clamp-2 break-all text-xs text-foreground/80">
            {name}
          </span>
        </div>
      )}

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
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
      >
        <RiCloseLine className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}
