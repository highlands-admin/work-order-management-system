'use client'

import { useRef, useTransition } from 'react'

import { APP_ROLES, ROLE_LABELS, type AppRole } from '@/lib/schemas/admin'

import { changeUserRoleAction } from '../actions'

export function RoleSelect({
  userId,
  currentRole,
  disabled,
  helpText,
}: {
  userId: string
  currentRole: AppRole
  disabled?: boolean
  helpText?: string
}) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={changeUserRoleAction}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || isPending}
        onChange={() => {
          if (!formRef.current) return
          const fd = new FormData(formRef.current)
          startTransition(() => {
            changeUserRoleAction(fd)
          })
        }}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
      >
        {APP_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      {helpText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
      ) : null}
    </form>
  )
}
