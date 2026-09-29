import type { SupabaseClient } from '@supabase/supabase-js'

import type { WorkOrderCategory } from '@/lib/schemas/work-order'

export type CategoryApprover = {
  name: string | null
  email: string
}

type ApproverRow = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

// Resolves every designated approver for a category from the
// category_approvers table, which administrators manage at /admin/approvers.
// Approvers who are no longer administrators are excluded by the RPC. Returns
// an empty list when the category has no approvers or the lookup fails. The
// caller treats an empty list as "no notification to send".
export async function getCategoryApprovers(
  supabase: SupabaseClient,
  category: WorkOrderCategory
): Promise<CategoryApprover[]> {
  const { data, error } = await supabase.rpc('get_category_approvers', {
    p_category: category,
  })

  if (error) {
    console.error('get_category_approvers failed', error)
    return []
  }

  return ((data ?? []) as ApproverRow[]).flatMap((row) => {
    const email = row.email?.trim()
    if (!email) return []
    const name = [row.first_name, row.last_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ')
    return [{ name: name || null, email }]
  })
}
