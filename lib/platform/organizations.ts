import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type PlatformOrganization = {
  id: string
  name: string
  slug: string
  allowed_email_domain: string | null
  member_count: number
  admin_count: number
  pending_admin_invites: number
  created_at: string
}

// Every organization with member and administrator counts. The RPC refuses
// callers who are not platform admins.
export async function listPlatformOrganizations(): Promise<{
  organizations: PlatformOrganization[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('platform_list_organizations')
  return {
    organizations: (data ?? []) as PlatformOrganization[],
    error: error?.message ?? null,
  }
}
