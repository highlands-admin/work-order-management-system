import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { signOutAction } from '@/app/(auth)/actions'
import { TimezoneSync } from '@/components/datetime/timezone-sync'
import { AppSidebar } from '@/components/nav/app-sidebar'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'

// The dashboard is an operations overview, limited to administrators and
// supervisors. Everyone else is sent back to the work order list.
const DASHBOARD_ROLES = new Set(['administrator', 'supervisor'])

export default async function DashboardLayout({
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
  if (!claims.user_role || !DASHBOARD_ROLES.has(claims.user_role)) {
    redirect('/work-orders')
  }

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'
  const timeZone = await getTimeZone()

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <TimezoneSync serverTimeZone={timeZone} />
      <AppSidebar userRole={claims.user_role} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-full" />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {claims.email}
            </span>
            <ThemeToggle />
            <Separator orientation="vertical" className="mx-1 hidden sm:block" />
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
