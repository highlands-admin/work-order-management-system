'use client'

import {
  RiBarChartBoxLine,
  RiCheckDoubleLine,
  RiClipboardLine,
  RiFileAddLine,
  RiGroupLine,
  RiInboxLine,
  RiMailAddLine,
  RiMailSendLine,
  RiNotification3Line,
  RiRepeatLine,
} from '@remixicon/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from 'react'

import { createClient } from '@/lib/supabase/client'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

type NavItem = {
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
}

const FILER_ROLES = new Set(['administrator', 'requester'])

const workOrderItems: NavItem[] = [
  { title: 'All Work Orders', href: '/work-orders', icon: RiClipboardLine },
  { title: 'My Work Orders', href: '/work-orders/mine', icon: RiInboxLine },
  {
    title: 'Recurring Schedules',
    href: '/work-orders/recurring',
    icon: RiRepeatLine,
  },
]

const newWorkOrderItem: NavItem = {
  title: 'Create Work Order',
  href: '/work-orders/new',
  icon: RiFileAddLine,
}

const adminItems: NavItem[] = [
  { title: 'Invite', href: '/admin/invite', icon: RiMailAddLine },
  { title: 'Invitations', href: '/admin/invitations', icon: RiMailSendLine },
  { title: 'Users', href: '/admin/users', icon: RiGroupLine },
]

export function AppSidebar({
  userRole,
  ...props
}: { userRole: string | undefined } & ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // Unread notification count for the badge. Refetched on navigation (so it
  // updates after the user reads notifications) via the browser client; RLS
  // scopes the count to the signed-in user.
  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .then(({ count }) => {
        if (active) setUnreadCount(count ?? 0)
      })
    return () => {
      active = false
    }
  }, [pathname])

  const canFile = userRole ? FILER_ROLES.has(userRole) : false
  const isAdmin = userRole === 'administrator'
  // The dashboard is an operations overview for administrators and supervisors.
  const isManager = isAdmin || userRole === 'supervisor'

  // Admins reach the queue from the Administration group ("Approval Queue").
  // Requesters reach it from the Work Orders group ("Submissions"), since
  // for them it's a personal tracking view.
  const submissionsItem: NavItem = {
    title: 'Submissions',
    href: '/work-orders/submissions',
    icon: RiCheckDoubleLine,
  }

  const workOrderNav = isAdmin
    ? [...workOrderItems, newWorkOrderItem]
    : canFile
      ? [...workOrderItems, newWorkOrderItem, submissionsItem]
      : workOrderItems

  const adminNav: NavItem[] = isAdmin
    ? [
        {
          title: 'Approval Queue',
          href: '/work-orders/submissions',
          icon: RiCheckDoubleLine,
        },
        ...adminItems,
      ]
    : adminItems

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link
          href="/work-orders"
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
          className="font-heading px-2 py-1.5 text-base font-semibold"
        >
          Cadence
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {isManager ? (
                <NavMenuItem
                  item={{
                    title: 'Dashboard',
                    href: '/dashboard',
                    icon: RiBarChartBoxLine,
                  }}
                  pathname={pathname}
                />
              ) : null}
              <NavMenuItem
                item={{
                  title: 'Notifications',
                  href: '/notifications',
                  icon: RiNotification3Line,
                }}
                pathname={pathname}
                badge={unreadCount}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Work Orders</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workOrderNav.map((item) => (
                <NavMenuItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <NavMenuItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function NavMenuItem({
  item,
  pathname,
  badge = 0,
}: {
  item: NavItem
  pathname: string
  badge?: number
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const Icon = item.icon
  // Exact match on /work-orders avoids highlighting the list when on /work-orders/new.
  const isActive =
    pathname === item.href ||
    (item.href !== '/work-orders' && pathname.startsWith(`${item.href}/`))
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            href={item.href}
            onClick={() => {
              // On mobile the sidebar is an overlay sheet; close it on navigation.
              if (isMobile) setOpenMobile(false)
            }}
          />
        }
      >
        <Icon className="size-4" />
        <span>{item.title}</span>
        {badge > 0 ? (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
