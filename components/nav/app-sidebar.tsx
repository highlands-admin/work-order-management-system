'use client'

import {
  RiCheckDoubleLine,
  RiClipboardLine,
  RiFileAddLine,
  RiGroupLine,
  RiInboxLine,
  RiMailAddLine,
  RiMailSendLine,
} from '@remixicon/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps, ComponentType } from 'react'

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
  const canFile = userRole ? FILER_ROLES.has(userRole) : false
  const isAdmin = userRole === 'administrator'

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
          Highlands Cadence
        </Link>
      </SidebarHeader>
      <SidebarContent>
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
}: {
  item: NavItem
  pathname: string
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
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
