import type { SupabaseClient } from '@supabase/supabase-js'

import type { WorkOrderCategory } from '@/lib/schemas/work-order'

// One row of the default_assignees table, which administrators manage at
// /admin/default-assignees. A null itRequestType is the category's default; an
// IT request type overrides it for that type of request.
export type DefaultAssigneeRule = {
  category: WorkOrderCategory
  itRequestType: string | null
  userId: string
}

// Loads the caller's organization's default assignees. RLS limits the table
// to administrators, who are the only ones that apply defaults. Returns an
// empty list when the lookup fails, so a failure leaves work orders unassigned
// as before rather than blocking the create or approval.
export async function fetchDefaultAssigneeRules(
  supabase: SupabaseClient
): Promise<DefaultAssigneeRule[]> {
  const { data, error } = await supabase
    .from('default_assignees')
    .select('category, it_request_type, user_id')
  if (error) {
    console.error('default_assignees lookup failed', error)
    return []
  }
  return (
    (data ?? []) as {
      category: WorkOrderCategory
      it_request_type: string | null
      user_id: string
    }[]
  ).map((row) => ({
    category: row.category,
    itRequestType: row.it_request_type,
    userId: row.user_id,
  }))
}

// Returns who a work order falls to when nobody is picked, or null when no
// default applies. A rule for the exact IT request type wins over the
// category's default.
export function resolveDefaultAssignee(
  rules: DefaultAssigneeRule[],
  category: WorkOrderCategory,
  itRequestType: string | null | undefined
): string | null {
  const forCategory = rules.filter((r) => r.category === category)
  const specific = itRequestType
    ? forCategory.find((r) => r.itRequestType === itRequestType)
    : undefined
  const fallback = forCategory.find((r) => r.itRequestType === null)
  return (specific ?? fallback)?.userId ?? null
}
