import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { signOutAction } from '@/app/(auth)/actions'
import { AppSidebar } from '@/components/nav/app-sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as
    | { user_role?: string; email?: string }
    | undefined

  if (!claims) redirect('/login')
  if (claims.user_role !== 'administrator') redirect('/work-orders')

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar userRole={claims.user_role} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-full" />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {claims.email}
            </span>
            <form action={signOutAction}>
              <Button type="submit" size="sm" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
