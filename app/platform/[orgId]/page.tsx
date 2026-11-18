import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormSection } from '@/components/forms/form-section'
import { PropertiesManager } from '@/components/properties/properties-manager'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/datetime/format'
import { getTimeZone } from '@/lib/datetime/timezone'
import {
  listPlatformOrganizations,
  type PlatformAdminInvitation,
  type PlatformOrgAdmin,
} from '@/lib/platform/organizations'
import { createClient } from '@/lib/supabase/server'
import type { PropertyOption } from '@/lib/work-orders/properties'

import {
  platformAddPropertyAction,
  platformRenamePropertyAction,
  platformResendInvitationAction,
  platformRevokeInvitationAction,
  platformSetOwnerAction,
  platformSetPropertyActiveAction,
} from '../actions'
import { AccessControl } from './access-control'
import { OpenDemoForm } from './open-demo-form'
import { InviteAdminForm } from './invite-admin-form'
import { OrganizationSettingsForm } from './organization-settings-form'

export const metadata: Metadata = { title: 'Organization' }

type PropertyRow = { key: string; name: string; is_active: boolean }

const HEAD_CLASS = 'px-4 text-xs uppercase tracking-wide text-muted-foreground'

const STATUS_LABEL: Record<PlatformAdminInvitation['status'], string> = {
  pending: 'Waiting to accept',
  accepted: 'Accepted',
  revoked: 'Cancelled',
  expired: 'Expired',
}

const STATUS_COLOR: Record<PlatformAdminInvitation['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  accepted:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  revoked: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
  expired: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

export default async function PlatformOrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const { organizations, error } = await listPlatformOrganizations()
  const organization = organizations.find((org) => org.id === orgId)
  if (!organization) {
    if (error) throw new Error(error)
    notFound()
  }

  const supabase = await createClient()
  const [
    { data: propertyRows, error: propertiesError },
    { data: adminRows, error: adminsError },
    { data: inviteRows, error: invitesError },
    timeZone,
  ] = await Promise.all([
    supabase.rpc('platform_list_properties', { p_organization_id: orgId }),
    supabase.rpc('platform_list_org_admins', { p_organization_id: orgId }),
    supabase.rpc('platform_list_admin_invitations', {
      p_organization_id: orgId,
    }),
    getTimeZone(),
  ])
  const admins = (adminRows ?? []) as PlatformOrgAdmin[]
  const invitations = (inviteRows ?? []) as PlatformAdminInvitation[]
  const suspended = organization.suspended_at !== null
  const properties: PropertyOption[] = (
    (propertyRows ?? []) as PropertyRow[]
  ).map((row) => ({ key: row.key, name: row.name, isActive: row.is_active }))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/platform"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          All organizations
        </Link>
        <h1 className="font-heading mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {organization.name}
          {suspended ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              Paused
            </span>
          ) : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          {organization.member_count}{' '}
          {organization.member_count === 1 ? 'member' : 'members'},{' '}
          {organization.admin_count}{' '}
          {organization.admin_count === 1 ? 'administrator' : 'administrators'}
          {organization.pending_admin_invites > 0
            ? `, ${organization.pending_admin_invites} administrator ${
                organization.pending_admin_invites === 1
                  ? 'invitation'
                  : 'invitations'
              } pending`
            : ''}
        </p>
      </div>

      <FormSection
        id="access"
        title="Access"
        description="Pause the organization to block every member without deleting anything. Resume to restore it exactly as it was."
      >
        <AccessControl
          organizationId={organization.id}
          organizationName={organization.name}
          suspended={suspended}
          isOwn={organization.is_own}
        />
      </FormSection>

      <section aria-labelledby="admins-title" className="flex flex-col gap-4">
        <div>
          <h2 id="admins-title" className="font-heading text-lg font-semibold">
            Administrators and invitations
          </h2>
          <p className="text-sm text-muted-foreground">
            Who accepted, who has not yet, and when each administrator last
            signed in.
          </p>
        </div>
        {adminsError || invitesError ? (
          <p className="text-sm text-destructive">
            {(adminsError ?? invitesError)?.message}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
          {admins.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No administrator has signed up yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={HEAD_CLASS}>Administrator</TableHead>
                  <TableHead className={HEAD_CLASS}>Joined</TableHead>
                  <TableHead className={HEAD_CLASS}>Last signed in</TableHead>
                  <TableHead className={`${HEAD_CLASS} text-right`}>
                    Owner
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.user_id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {admin.full_name ?? admin.email}
                        {admin.is_owner ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Owner
                          </span>
                        ) : null}
                      </div>
                      {admin.full_name ? (
                        <div className="text-xs text-muted-foreground">
                          {admin.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatDate(admin.joined_at, timeZone)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {admin.last_sign_in_at
                        ? formatDateTime(admin.last_sign_in_at, timeZone)
                        : 'Never'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <form action={platformSetOwnerAction}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="userId" value={admin.user_id} />
                        <input
                          type="hidden"
                          name="isOwner"
                          value={admin.is_owner ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          className={`rounded-md px-2 py-1 text-xs font-medium hover:bg-muted ${admin.is_owner ? 'text-destructive' : 'text-foreground'}`}
                        >
                          {admin.is_owner ? 'Remove owner' : 'Make owner'}
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {invitations.length > 0 ? (
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={HEAD_CLASS}>Invited</TableHead>
                  <TableHead className={HEAD_CLASS}>Status</TableHead>
                  <TableHead className={HEAD_CLASS}>Sent</TableHead>
                  <TableHead className={HEAD_CLASS}>Link expires</TableHead>
                  <TableHead className={`${HEAD_CLASS} text-right`}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="px-4 py-3">{invite.email}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[invite.status]}`}
                      >
                        {STATUS_LABEL[invite.status]}
                      </span>
                      {invite.make_owner ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          as owner
                        </span>
                      ) : null}
                      {invite.accepted_at ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(invite.accepted_at, timeZone)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatDate(invite.created_at, timeZone)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {invite.status === 'pending'
                        ? formatDate(invite.expires_at, timeZone)
                        : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {!suspended &&
                      (invite.status === 'pending' ||
                        invite.status === 'expired') ? (
                        <div className="flex justify-end gap-2">
                          <form action={platformResendInvitationAction}>
                            <input
                              type="hidden"
                              name="organizationId"
                              value={organization.id}
                            />
                            <input
                              type="hidden"
                              name="invitationId"
                              value={invite.id}
                            />
                            <button
                              type="submit"
                              className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              Resend
                            </button>
                          </form>
                          {invite.status === 'pending' ? (
                            <form action={platformRevokeInvitationAction}>
                              <input
                                type="hidden"
                                name="organizationId"
                                value={organization.id}
                              />
                              <input
                                type="hidden"
                                name="invitationId"
                                value={invite.id}
                              />
                              <button
                                type="submit"
                                className="rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                Cancel
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>

      <FormSection
        id="demo"
        title="Demo view"
        description="See Workflow 360 exactly as this organization's administrators do, without being able to change anything."
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Opens the organization through its own read-only demo account
            {organization.has_demo ? '' : ', which is created the first time'}.
            Every save is blocked, and no emails go to it. This signs you out
            of the platform admin, so use Exit demo in the banner and sign back
            in when you are done.
          </p>
          <OpenDemoForm
            organizationId={organization.id}
            organizationName={organization.name}
            disabled={suspended}
          />
          {suspended ? (
            <p className="text-muted-foreground">
              Resume access to open the demo.
            </p>
          ) : null}
        </div>
      </FormSection>

      <FormSection
        id="settings"
        title="Settings"
        description="The organization's name and who can sign up without an invitation."
      >
        <OrganizationSettingsForm
          organizationId={organization.id}
          name={organization.name}
          domain={organization.allowed_email_domain}
        />
      </FormSection>

      <FormSection
        id="invite-admin"
        title="Invite an administrator"
        description="Administrators manage the organization's users and approvers."
      >
        <InviteAdminForm
          organizationId={organization.id}
          defaultOwner={!admins.some((admin) => admin.is_owner)}
        />
      </FormSection>

      <section aria-labelledby="properties-title" className="flex flex-col gap-4">
        <div>
          <h2
            id="properties-title"
            className="font-heading text-lg font-semibold"
          >
            Properties
          </h2>
          <p className="text-sm text-muted-foreground">
            The facilities offered on this organization&apos;s work order forms.
            Only platform admins can change them.
          </p>
        </div>
        {propertiesError ? (
          <p className="text-sm text-destructive">{propertiesError.message}</p>
        ) : null}
        <PropertiesManager
          properties={properties}
          addAction={platformAddPropertyAction.bind(null, organization.id)}
          renameAction={platformRenamePropertyAction.bind(null, organization.id)}
          setActiveAction={platformSetPropertyActiveAction.bind(
            null,
            organization.id
          )}
        />
      </section>
    </div>
  )
}
