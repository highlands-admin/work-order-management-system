import * as z from 'zod'

// Images only for the first version. JPEG, PNG, and WebP cover what phones and
// browsers produce, and each re-encodes cleanly during client-side
// compression.
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

// Upper bound on a single stored file. Client-side compression targets well
// under this; the cap is a backstop against an oversized or unprocessed file.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

// Cap per work order so a single submission cannot flood storage.
export const MAX_ATTACHMENTS_PER_WORK_ORDER = 10

// Body of a presign request: the browser describes the file it wants to upload,
// and the server returns a presigned PUT URL for it.
export const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})

export type PresignRequest = z.infer<typeof presignRequestSchema>

// Metadata the uploader hands back to the form after a successful PUT, carried
// as a hidden field and parsed by the create/update actions before the row is
// inserted.
export const attachmentMetadataSchema = z.object({
  key: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  name: z.string().max(255).optional(),
})

export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>
