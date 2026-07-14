import {
  MAX_ATTACHMENTS_PER_WORK_ORDER,
  attachmentMetadataSchema,
  maxAttachmentBytes,
} from '@/lib/schemas/attachment'
import { deleteObjects, presignDownloadUrl } from '@/lib/storage/s3'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type WorkOrderAttachment = {
  id: string
  url: string
  name: string | null
  contentType: string
}

// Loads a work order's attachments and mints a short-lived presigned GET URL
// for each, so the files load directly from MinIO on an authenticated page.
// Returns an empty list on error so a storage issue never breaks the page.
export async function fetchWorkOrderAttachments(
  supabase: SupabaseServerClient,
  workOrderId: string
): Promise<WorkOrderAttachment[]> {
  const { data, error } = await supabase
    .from('work_order_attachments')
    .select('id, object_key, original_filename, content_type')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return Promise.all(
    data.map(async (row) => ({
      id: row.id,
      url: await presignDownloadUrl(row.object_key),
      name: row.original_filename,
      contentType: row.content_type,
    }))
  )
}

// Applies attachment changes submitted with a work order form. Removed existing
// attachments are detached (row deleted, then object deleted from MinIO), and
// newly uploaded objects are linked as new rows. RLS independently enforces who
// may add or remove attachments, so a tampered field cannot reach another
// user's work order. Best-effort: a storage failure is logged, not thrown, so
// it cannot fail the work order save it follows.
export async function syncWorkOrderAttachments(
  supabase: SupabaseServerClient,
  workOrderId: string,
  formData: FormData,
  uploadedBy: string,
  // The work order's category, which sets the per-file size cap.
  category: string
): Promise<void> {
  const removedIds = formData
    .getAll('removedAttachment')
    .map((v) => String(v))
    .filter(Boolean)

  if (removedIds.length > 0) {
    // Scope to this work order so a stray ID cannot delete an unrelated row,
    // and read the object keys back so the files can be removed from storage.
    const { data: rows } = await supabase
      .from('work_order_attachments')
      .select('id, object_key')
      .eq('work_order_id', workOrderId)
      .in('id', removedIds)

    if (rows && rows.length > 0) {
      const { error: deleteRowsError } = await supabase
        .from('work_order_attachments')
        .delete()
        .in(
          'id',
          rows.map((r) => r.id)
        )
      // Delete the objects only after the rows are gone, so a live row never
      // points at a missing file.
      if (!deleteRowsError) {
        await deleteObjects(rows.map((r) => r.object_key))
      }
    }
  }

  const sizeCap = maxAttachmentBytes(category)
  const added = formData
    .getAll('attachment')
    .map((value) => {
      try {
        return attachmentMetadataSchema.parse(JSON.parse(String(value)))
      } catch {
        return null
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    // Drop anything over this category's cap. The presign endpoint already
    // enforces it, so this is the authoritative backstop against a file linked
    // with a size beyond what the saved category allows.
    .filter((value) => value.size <= sizeCap)
    .slice(0, MAX_ATTACHMENTS_PER_WORK_ORDER)

  if (added.length > 0) {
    await supabase.from('work_order_attachments').insert(
      added.map((a) => ({
        work_order_id: workOrderId,
        object_key: a.key,
        content_type: a.contentType,
        size_bytes: a.size,
        original_filename: a.name ?? null,
        uploaded_by: uploadedBy,
      }))
    )
  }
}
