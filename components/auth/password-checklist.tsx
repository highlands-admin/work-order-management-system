import { RiCheckLine, RiCloseLine } from '@remixicon/react'

import { cn } from '@/lib/utils'

type ChecklistState = 'idle' | 'passed' | 'failed'

const PASSWORD_CHECKS: { label: string; test: (v: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /\d/.test(v) },
  { label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export function PasswordChecklist({
  value,
  showErrors,
}: {
  value: string
  showErrors?: boolean
}) {
  const empty = value.length === 0
  return (
    <ul className="mt-1 flex flex-col gap-1 text-sm">
      {PASSWORD_CHECKS.map((check) => {
        const passed = !empty && check.test(value)
        const state: ChecklistState = passed
          ? 'passed'
          : showErrors
            ? 'failed'
            : 'idle'
        return (
          <ChecklistItem key={check.label} label={check.label} state={state} />
        )
      })}
    </ul>
  )
}

export function ConfirmPasswordChecklist({
  value,
  password,
  showErrors,
}: {
  value: string
  password: string
  showErrors?: boolean
}) {
  const empty = value.length === 0
  const passed = !empty && value === password
  const state: ChecklistState = passed
    ? 'passed'
    : showErrors
      ? 'failed'
      : 'idle'
  return (
    <ul className="mt-1 flex flex-col gap-1 text-sm">
      <ChecklistItem label="Passwords match" state={state} />
    </ul>
  )
}

function ChecklistItem({
  label,
  state,
}: {
  label: string
  state: ChecklistState
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-1.5 transition-colors',
        state === 'passed' && 'text-emerald-600 dark:text-emerald-500',
        state === 'failed' && 'text-destructive',
        state === 'idle' && 'text-muted-foreground'
      )}
    >
      {state === 'passed' ? (
        <RiCheckLine className="size-3.5" aria-hidden />
      ) : (
        <RiCloseLine
          className={cn('size-3.5', state === 'idle' && 'opacity-50')}
          aria-hidden
        />
      )}
      <span>{label}</span>
    </li>
  )
}
