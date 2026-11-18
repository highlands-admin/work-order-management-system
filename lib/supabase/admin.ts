import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin Supabase client for trusted backend code only (cron-triggered routes,
// and platform admin actions that create and sign in to demo accounts after
// checking super admin status).
// It uses the Supabase secret key (sb_secret_...), which bypasses Row Level
// Security, so it must never be used in a path reachable by an unauthenticated
// or unprivileged caller. The reminder route authenticates with a shared
// secret first; the platform demo action calls requireSuperAdmin() first.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.')
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not configured.')
  }

  return createSupabaseClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
