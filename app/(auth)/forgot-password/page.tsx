import type { Metadata } from 'next'
import Link from 'next/link'

import { AuthCard } from '@/components/auth/auth-card'

import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = { title: 'Reset password' }

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return (
    <AuthCard
      title="Reset Your Password"
      description="Enter your account email and we will send a 6-digit code."
      footer={
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm defaultEmail={email ?? ''} />
    </AuthCard>
  )
}
