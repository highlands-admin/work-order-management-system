'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SubmitButton({
  label,
  pendingLabel,
  disabled,
  className,
}: {
  label: string
  pendingLabel: string
  disabled?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="cta"
      disabled={pending || disabled}
      className={cn(className)}
    >
      {pending ? pendingLabel : label}
    </Button>
  )
}
