import { RiAddLine } from '@remixicon/react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { LinkTableRow } from '@/components/ui/link-table-row'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listPlatformOrganizations } from '@/lib/platform/organizations'

export const metadata: Metadata = { title: 'Organizations' }

const HEAD_CLASS = 'px-4 text-xs uppercase tracking-wide text-muted-foreground'

export default async function PlatformPage() {
  const { organizations, error } = await listPlatformOrganizations()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Every organization using the app. Platform admins manage settings
            and properties here but cannot see any organization&apos;s work
            orders.
          </p>
        </div>
        <Link href="/platform/new" className={buttonVariants({ size: 'cta' })}>
          <RiAddLine className="size-5" />
          New organization
        </Link>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        {organizations.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No organizations yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className={HEAD_CLASS}>Name</TableHead>
                <TableHead className={HEAD_CLASS}>Signup domain</TableHead>
                <TableHead className={HEAD_CLASS}>Members</TableHead>
                <TableHead className={HEAD_CLASS}>Administrators</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <LinkTableRow key={org.id} href={`/platform/${org.id}`}>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/platform/${org.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {org.allowed_email_domain ?? 'Invitation only'}
                  </TableCell>
                  <TableCell className="px-4 py-3">{org.member_count}</TableCell>
                  <TableCell className="px-4 py-3">
                    {org.admin_count}
                    {org.pending_admin_invites > 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({org.pending_admin_invites} invited)
                      </span>
                    ) : null}
                  </TableCell>
                </LinkTableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
