'use client'

import { useState } from 'react'

import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function EmailField({
  id = 'email',
  name = 'email',
  label = 'Email',
  placeholder = 'username@highlands.care',
  autoFocus,
  defaultValue = '',
  serverError,
  required,
  onValueChange,
}: {
  id?: string
  name?: string
  label?: string
  placeholder?: string
  autoFocus?: boolean
  defaultValue?: string
  serverError?: string
  required?: boolean
  onValueChange?: () => void
}) {
  const [value, setValue] = useState(defaultValue)

  return (
    <Field data-invalid={serverError ? 'true' : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type="email"
        autoComplete="email"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onValueChange?.()
        }}
        aria-invalid={serverError ? true : undefined}
        required={required}
      />
      <FieldError>{serverError}</FieldError>
    </Field>
  )
}
