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
}: {
  label: string
  pendingLabel: string
  disabled?: boolean
  className?: string
  size?: ComponentProps<typeof Button>['size']
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size={size}
      disabled={pending || disabled}
      className={cn(className)}
    >
      {pending ? pendingLabel : label}
    </Button>
  )
}
