import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

import { signOutAction } from './(auth)/actions'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  requester: 'Requester',
  supervisor: 'Supervisor',
  technician: 'Technician',
  inspector: 'Inspector',
}

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) redirect('/login')

  const claims = data.claims as {
    email?: string
    user_role?: string
    user_metadata?: { first_name?: string; last_name?: string }
  }
  const firstName = claims.user_metadata?.first_name
  const lastName = claims.user_metadata?.last_name
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') || claims.email
  const roleLabel = claims.user_role
    ? (ROLE_LABELS[claims.user_role] ?? claims.user_role)
    : 'No role assigned'

  return (
    <div className="flex flex-1 items-center justify-center bg-muted px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
        <h1 className="font-heading text-2xl font-semibold">
          Welcome, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {claims.email} · {roleLabel}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {claims.user_role === 'administrator' ? (
            <Link href="/admin" className={buttonVariants({ variant: 'default' })}>
              Admin
            </Link>
          ) : (
            <Link href="/work-orders" className={buttonVariants({ variant: 'default' })}>
              Work Orders
            </Link>
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
