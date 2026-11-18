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
  // Set while a platform admin has paused the organization.
  suspended_at: string | null
  has_demo: boolean
  // The organization the signed-in platform admin belongs to.
  is_own: boolean
}

export type PlatformAdminInvitation = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
}

export type PlatformOrgAdmin = {
  user_id: string
  email: string
  full_name: string | null
  last_sign_in_at: string | null
  joined_at: string
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
