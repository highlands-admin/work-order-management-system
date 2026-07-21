'use client'

import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiDownloadLine,
} from '@remixicon/react'
import { useEffect, useState } from 'react'

import { FileIcon } from '@/components/work-orders/file-icon'
import { isImageType } from '@/lib/schemas/attachment'

export type GalleryAttachment = {
  id: string
  url: string
  name: string | null
  contentType: string
}

// Renders a work order's attachments: images as a thumbnail grid that opens an
// in-app preview, and documents as a list of downloadable file rows.
export function AttachmentGallery({
  attachments,
}: {
  attachments: GalleryAttachment[]
}) {
  const images = attachments.filter((a) => isImageType(a.contentType))
  const documents = attachments.filter((a) => !isImageType(a.contentType))

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const active = activeIndex !== null ? images[activeIndex] : null
  const hasMultiple = images.length > 1

  function showPrev() {
    setActiveIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length))
  }
  function showNext() {
    setActiveIndex((i) => (i === null ? i : (i + 1) % images.length))
  }

  // While the preview is open, close on Escape, step with the arrow keys, and
  // lock background scrolling.
  useEffect(() => {
    if (!active) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveIndex(null)
      else if (event.key === 'ArrowLeft' && hasMultiple) showPrev()
      else if (event.key === 'ArrowRight' && hasMultiple) showNext()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasMultiple])

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="block aspect-square w-full overflow-hidden rounded-lg ring-1 ring-foreground/10 transition-opacity hover:opacity-90"
              >
                {/* eslint-disable-next-line @next/next/no-img-element --
                    presigned URLs are short-lived and already compressed, so
                    Next image optimization adds cost without benefit. */}
                <img
                  src={photo.url}
                  alt={photo.name ?? 'Work order photo'}
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {documents.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
              >
                <FileIcon
                  contentType={doc.contentType}
                  className="size-5 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {doc.name ?? 'Attachment'}
                </span>
                <RiDownloadLine
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={() => setActiveIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
        >
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setActiveIndex(null)}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:bg-black/70"
            >
              <RiCloseLine className="size-5" aria-hidden="true" />
            </button>

            {hasMultiple ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={showPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:bg-black/70"
                >
                  <RiArrowLeftSLine className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={showNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:bg-black/70"
                >
                  <RiArrowRightSLine className="size-6" aria-hidden="true" />
                </button>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium tabular-nums text-white">
                  {(activeIndex ?? 0) + 1} / {images.length}
                </span>
              </>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            <img
              src={active.url}
              alt={active.name ?? 'Work order photo'}
              className="block max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
