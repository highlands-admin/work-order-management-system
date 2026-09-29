import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

// The signed-in user's organization id, or null when signed out or without a
// role. Reads the org_id claim the access token hook adds, and falls back to
// the database for tokens issued before the claim existed, the same way
// current_org_id() does in SQL.
export async function getCurrentOrgId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { sub?: string; org_id?: string } | undefined
  if (!claims?.sub) return null
  if (claims.org_id) return claims.org_id

  const { data: orgId } = await supabase.rpc('current_org_id')
  return typeof orgId === 'string' ? orgId : null
}
