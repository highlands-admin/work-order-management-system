import type { Metadata } from 'next'
import Link from 'next/link'

import { CreateOrganizationForm } from './create-organization-form'

export const metadata: Metadata = { title: 'New organization' }

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <Link
          href="/platform"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          All organizations
        </Link>
        <h1 className="font-heading mt-1 text-2xl font-semibold">
          New organization
        </h1>
        <p className="text-sm text-muted-foreground">
          Creates the organization and invites its first administrator. You can
          add its properties on the next page.
        </p>
      </div>
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <CreateOrganizationForm />
      </div>
    </div>
  )
}
