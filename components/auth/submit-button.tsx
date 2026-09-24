'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SubmitButton({
  label,
  pendingLabel,
  disabled,
  className,
  size = 'cta',
  form,
  pending: pendingOverride,
}: {
  label: string
  pendingLabel: string
  disabled?: boolean
  className?: string
  size?: ComponentProps<typeof Button>['size']
  // The id of the form this button submits, for a button rendered outside it.
  form?: string
  // useFormStatus only sees a submission from inside the form element, so a
  // button placed outside one passes the pending flag in directly.
  pending?: boolean
}) {
  const { pending: formPending } = useFormStatus()
  const pending = pendingOverride ?? formPending
  return (
    <Button
      type="submit"
      form={form}
      size={size}
      disabled={pending || disabled}
      className={cn(className)}
    >
      {pending ? pendingLabel : label}
    </Button>
  )
}
