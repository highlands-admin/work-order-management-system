import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PropertiesManager } from '@/components/properties/properties-manager'
import { listPlatformOrganizations } from '@/lib/platform/organizations'
import { createClient } from '@/lib/supabase/server'
import type { PropertyOption } from '@/lib/work-orders/properties'

import {
  platformAddPropertyAction,
  platformRenamePropertyAction,
  platformSetPropertyActiveAction,
} from '../actions'
import { InviteAdminForm } from './invite-admin-form'
import { OrganizationSettingsForm } from './organization-settings-form'

export const metadata: Metadata = { title: 'Organization' }

type PropertyRow = { key: string; name: string; is_active: boolean }

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
  const { data: propertyRows, error: propertiesError } = await supabase.rpc(
    'platform_list_properties',
    { p_organization_id: orgId }
  )
  const properties: PropertyOption[] = (
    (propertyRows ?? []) as PropertyRow[]
  ).map((row) => ({ key: row.key, name: row.name, isActive: row.is_active }))

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href="/platform"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          All organizations
        </Link>
        <h1 className="font-heading mt-1 text-2xl font-semibold">
          {organization.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {organization.member_count} members, {organization.admin_count}{' '}
          administrators
          {organization.pending_admin_invites > 0
            ? `, ${organization.pending_admin_invites} administrator invitation pending`
            : ''}
          .
        </p>
      </div>

      <section className="flex max-w-xl flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">Settings</h2>
        <OrganizationSettingsForm
          organizationId={organization.id}
          name={organization.name}
          domain={organization.allowed_email_domain}
        />
      </section>

      <section className="flex max-w-xl flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Invite an administrator
          </h2>
          <p className="text-sm text-muted-foreground">
            Administrators manage the organization&apos;s users, approvers, and
            properties.
          </p>
        </div>
        <InviteAdminForm organizationId={organization.id} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Properties</h2>
          <p className="text-sm text-muted-foreground">
            The facilities offered on this organization&apos;s work order forms.
            Its administrators can also manage these.
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
