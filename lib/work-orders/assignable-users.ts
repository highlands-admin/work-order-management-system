import type { SupabaseClient } from '@supabase/supabase-js'

export type AssignableUser = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

// Fetches the directory used to populate the work-order assignee dropdown.
// The RPC is exposed to all authenticated users and gets ordered by name on
// the server, so the result can be rendered as-is.
export async function fetchAssignableUsers(
  supabase: SupabaseClient
): Promise<AssignableUser[]> {
  const { data, error } = await supabase.rpc('list_assignable_users')
  if (error) {
    console.error('list_assignable_users failed', error)
    return []
  }
  return (data ?? []) as AssignableUser[]
}

// Returns the display label for an assignee. Falls back to email when a user
// has not filled in a name (e.g., the bootstrap admin) so the dropdown never
// shows a blank row.
export function formatAssigneeLabel(user: AssignableUser): string {
  const name = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  return name || user.email || user.user_id
}

