import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/auth-card'
import { createClient } from '@/lib/supabase/server'

import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = { title: 'Set new password' }

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) redirect('/forgot-password')

  return (
    <AuthCard
      title="Set a new password"
      description="Your code has been verified. Choose a new password to finish."
    >
      <ResetPasswordForm />
    </AuthCard>
  )
}
