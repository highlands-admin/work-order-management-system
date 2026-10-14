import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/auth-card'
import { createClient } from '@/lib/supabase/server'

import { LoginCodeForm } from './login-code-form'

export const metadata: Metadata = { title: 'Enter sign-in code' }

export default async function LoginCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  if (!email) redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims) redirect('/work-orders')

  return (
    <AuthCard
      title="Enter your sign-in code"
      description={
        <>
          We sent a 6-digit code to{' '}
          <span className="font-medium text-foreground">{email}</span>. Enter it
          below to sign in.
        </>
      }
      footer={
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <LoginCodeForm email={email} />
    </AuthCard>
  )
}
