'use client'

import { RiArrowDownSLine } from '@remixicon/react'
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
      {/* Native arrow is hidden (appearance-none) and replaced with a custom
          chevron, so its spacing from the right border is controllable. */}
      <div className="relative inline-block">
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
          className="h-7 appearance-none rounded-md border border-input bg-transparent pl-2 pr-7 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
        >
          {APP_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <RiArrowDownSLine
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      {helpText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
      ) : null}
    </form>
  )
}
