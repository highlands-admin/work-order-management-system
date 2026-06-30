import * as z from 'zod'

// Images get client-side compression and inline previews; everything else is
// stored as uploaded and shown as a file. This subset is checked to decide
// which path a file takes.
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

// Every content type a work order attachment may have. Videos are absent by
// design, so they are rejected by omission.
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
] as const

export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number]

// Browsers report inconsistent MIME types for Office files (often an empty
// string or application/octet-stream), so the content type is derived from the
// file extension instead of trusting file.type. This map is also the source of
// truth for which files are allowed at all.
export const ATTACHMENT_TYPES_BY_EXTENSION: Record<string, AllowedAttachmentType> =
  {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  }

// The accept attribute for the file input: the allowed extensions. A normal
// file input (no webkitdirectory) cannot select folders, so those are excluded
// for free.
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES_BY_EXTENSION).join(
  ','
)

// Documents are not compressed, so the cap is larger than an image needs. Keep
// it at or below the nginx client_max_body_size in front of MinIO (16M).
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

// Cap per work order so a single submission cannot flood storage.
export const MAX_ATTACHMENTS_PER_WORK_ORDER = 10

export function isImageType(contentType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)
}

// Resolves the allowed content type for a filename, or null if its extension is
// not on the allowlist.
export function attachmentTypeForFilename(
  filename: string
): AllowedAttachmentType | null {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/)
  if (!match) return null
  return ATTACHMENT_TYPES_BY_EXTENSION[match[0]] ?? null
}

// Body of a presign request: the browser describes the file it wants to upload,
// and the server returns a presigned PUT URL for it.
export const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_ATTACHMENT_TYPES),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})

export type PresignRequest = z.infer<typeof presignRequestSchema>

// Metadata the uploader hands back to the form after a successful PUT, carried
// as a hidden field and parsed by the create/update actions before the row is
// inserted.
export const attachmentMetadataSchema = z.object({
  key: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_ATTACHMENT_TYPES),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  name: z.string().max(255).optional(),
})

export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>
