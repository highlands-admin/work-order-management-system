'use client'

import { useActionState } from 'react'

import { SubmitButton } from '@/components/auth/submit-button'

import { platformOpenDemoAction } from '../actions'

export function OpenDemoForm({
  organizationId,
  organizationName,
  disabled,
}: {
  organizationId: string
  organizationName: string
  disabled: boolean
}) {
  const [error, action] = useActionState(platformOpenDemoAction, null)

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div>
        <SubmitButton
          label={`Open demo as ${organizationName}`}
          pendingLabel="Opening demo..."
          size="sm"
          disabled={disabled}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}
