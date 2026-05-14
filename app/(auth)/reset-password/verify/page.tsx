import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/auth-card'

import { VerifyResetForm } from './verify-reset-form'

export const metadata: Metadata = { title: 'Enter code' }

export default async function VerifyResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  if (!email) redirect('/forgot-password')

  return (
    <AuthCard
      title="Enter verification code"
      description={
        <>
          We sent a 6-digit code to{' '}
          <span className="font-medium text-foreground">{email}</span>. Enter it
          to continue.
        </>
      }
    >
      <VerifyResetForm email={email} />
    </AuthCard>
  )
}
