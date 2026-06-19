import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'

import { NotificationsList, type NotificationRow } from './notifications-list'

export const metadata: Metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) redirect('/login')

  const [{ data, error }, timeZone] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, body, work_order_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<NotificationRow[]>(),
    getTimeZone(),
  ])

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  return (
    <NotificationsList notifications={data ?? []} timeZone={timeZone} />
  )
}
