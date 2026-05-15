'use client'

import {
  RiClipboardLine,
  RiFileAddLine,
  RiGroupLine,
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
} from '@/components/ui/sidebar'

type NavItem = {
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
}

const FILER_ROLES = new Set(['administrator', 'supervisor', 'requester'])

const workOrderItems: NavItem[] = [
  { title: 'All Work Orders', href: '/work-orders', icon: RiClipboardLine },
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
  const canFile = userRole ? FILER_ROLES.has(userRole) : false
  const isAdmin = userRole === 'administrator'

  const workOrderNav = canFile
    ? [...workOrderItems, newWorkOrderItem]
    : workOrderItems

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link
          href="/"
          className="font-heading px-2 py-1.5 text-base font-semibold"
        >
          Work Orders
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
                {adminItems.map((item) => (
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
  const Icon = item.icon
  // Exact match on /work-orders avoids highlighting the list when on /work-orders/new.
  const isActive =
    pathname === item.href ||
    (item.href !== '/work-orders' && pathname.startsWith(`${item.href}/`))
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} render={<Link href={item.href} />}>
        <Icon className="size-4" />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
