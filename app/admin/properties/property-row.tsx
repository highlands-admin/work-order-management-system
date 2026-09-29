'use client'

import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import type { PropertyOption } from '@/lib/work-orders/properties'

import { renamePropertyAction, setPropertyActiveAction } from '../actions'

// One property with an inline rename field and a retire or restore button.
// Save appears only once the name differs from the stored one.
export function PropertyRow({ property }: { property: PropertyOption }) {
  const [name, setName] = useState(property.name)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const trimmed = name.trim()
  const dirty = trimmed !== property.name

  function save(): void {
    if (!dirty) return
    setError(null)
    startTransition(async () => {
      const message = await renamePropertyAction({
        key: property.key,
        name: trimmed,
      })
      if (message) setError(message)
    })
  }

  function toggleActive(): void {
    setError(null)
    startTransition(async () => {
      const message = await setPropertyActiveAction({
        key: property.key,
        isActive: !property.isActive,
      })
      if (message) setError(message)
    })
  }

  return (
    <TableRow>
      <TableCell className="px-4 py-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Input
            aria-label={`Name for ${property.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
            className="h-8 max-w-xs"
          />
          {dirty ? (
            <>
              <Button type="submit" size="sm" disabled={isPending || !trimmed}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  setName(property.name)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </>
          ) : null}
        </form>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </TableCell>
      <TableCell className="px-4 py-3">
        {property.isActive ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="secondary">Retired</Badge>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={toggleActive}
        >
          {property.isActive ? 'Retire' : 'Restore'}
        </Button>
      </TableCell>
    </TableRow>
  )
}
