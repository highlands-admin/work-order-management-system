import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { signOutAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Access paused' }

// Shown to members of an organization a platform admin has paused. Nothing
// was deleted; access returns as soon as the organization is resumed.
export default async function PausedPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { org_suspended?: boolean } | undefined
  if (!claims) redirect('/login')
  if (claims.org_suspended !== true) redirect('/work-orders')

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-4 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10 shadow-md">
        <h1 className="font-heading text-2xl font-semibold">Access paused</h1>
        <p className="text-muted-foreground">
          Your organization&apos;s access to Workflow 360 is paused. Your work
          orders and settings are kept and will be there when access returns.
          Please contact your administrator or Highlands for details.
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  )
}
