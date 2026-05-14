import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/auth-card'

import { VerifyForm } from './verify-form'

export const metadata: Metadata = { title: 'Verify email' }

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  if (!email) redirect('/signup')

  return (
    <AuthCard
      title="Verify your email"
      description={
        <>
          We sent a 6-digit code to{' '}
          <span className="font-medium text-foreground">{email}</span>. Enter it
          below to finish signing up.
        </>
      }
    >
      <VerifyForm email={email} />
    </AuthCard>
  )
}
