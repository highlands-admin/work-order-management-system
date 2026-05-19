import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/auth-card'
import { createClient } from '@/lib/supabase/server'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims) redirect('/work-orders')

  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password to access your account."
    >
      <LoginForm />
    </AuthCard>
  )
}
