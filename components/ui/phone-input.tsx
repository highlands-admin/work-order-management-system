'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'
import { formatUsPhone } from '@/lib/format/phone'

type PhoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> & {
  // Seeds the field once on mount; re-formatted so stored raw values display
  // correctly. The field is controlled thereafter.
  defaultValue?: string
  // Fires after each formatted change, mirroring the plain input's onChange so
  // callers can clear server-side field errors.
  onValueChange?: (value: string) => void
}

export function PhoneInput({
  defaultValue = '',
  onValueChange,
  ...props
}: PhoneInputProps): React.JSX.Element {
  const [value, setValue] = React.useState(() => formatUsPhone(defaultValue))

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatUsPhone(event.target.value)
    setValue(formatted)
    onValueChange?.(formatted)
  }

  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      value={value}
      onChange={handleChange}
    />
  )
}
