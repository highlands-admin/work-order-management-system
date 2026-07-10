import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const meta = (user.user_metadata ?? {}) as {
    first_name?: string
    last_name?: string
    phone?: string
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>

      <ProfileForm
        email={user.email ?? ''}
        firstName={meta.first_name ?? ''}
        lastName={meta.last_name ?? ''}
        phone={meta.phone ?? ''}
      />
    </div>
  )
}
