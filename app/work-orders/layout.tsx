import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { signOutAction } from '@/app/(auth)/actions'
import { AppSidebar } from '@/components/nav/app-sidebar'
import { ThemeToggle } from '@/components/nav/theme-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function WorkOrdersLayout({
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

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar userRole={claims.user_role} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/65">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {claims.email}
            </span>
            <ThemeToggle />
            <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
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
