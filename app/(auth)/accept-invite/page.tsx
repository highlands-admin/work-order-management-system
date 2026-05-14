import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/auth-card'
import { createClient } from '@/lib/supabase/server'

import { AcceptInviteForm } from './accept-invite-form'

export const metadata: Metadata = { title: 'Accept invitation' }

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect('/login')

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (claims?.claims) redirect('/')

  const { data: invites, error } = await supabase.rpc('invitation_by_token', {
    p_token: token,
  })

  if (error || !invites || invites.length === 0) {
    return (
      <AuthCard
        title="Invitation not found"
        description="This invitation link is invalid, has expired, or has already been used. Ask an administrator to send a new one."
        footer={
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <div />
      </AuthCard>
    )
  }

  const invite = invites[0]

  return (
    <AuthCard
      title="Accept your invitation"
      description={
        <>
          You have been invited to join as{' '}
          <span className="font-medium text-foreground">{invite.role}</span>{' '}
          with the email{' '}
          <span className="font-medium text-foreground">{invite.email}</span>.
          Set a password to finish.
        </>
      }
    >
      <AcceptInviteForm
        token={token}
        firstName={invite.first_name ?? ''}
        lastName={invite.last_name ?? ''}
      />
    </AuthCard>
  )
}
