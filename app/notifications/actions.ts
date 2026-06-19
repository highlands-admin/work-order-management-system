'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

// Marks a single notification read. RLS scopes the update to the caller's own
// rows, so a forged id for someone else's notification is a no-op.
export async function markNotificationReadAction(
  notificationId: string
): Promise<{ status: 'success' | 'error'; message?: string }> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) {
    return { status: 'error', message: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null)

  if (error) return { status: 'error', message: error.message }

  revalidatePath('/notifications')
  return { status: 'success' }
}

// Marks every unread notification for the caller as read.
export async function markAllNotificationsReadAction(): Promise<{
  status: 'success' | 'error'
  message?: string
}> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined
  if (!claims?.sub) {
    return { status: 'error', message: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', claims.sub)
    .is('read_at', null)

  if (error) return { status: 'error', message: error.message }

  revalidatePath('/notifications')
  return { status: 'success' }
}
