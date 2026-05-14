import { useState } from 'react'

export function useServerErrors(
  state: unknown,
  fieldErrors: Record<string, string[] | undefined> = {}
) {
  const [storedState, setStoredState] = useState(state)
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set())

  if (storedState !== state) {
    setStoredState(state)
    setEditedFields(new Set())
  }

  function markEdited(name: string) {
    setEditedFields((prev) => {
      if (prev.has(name)) return prev
      const next = new Set(prev)
      next.add(name)
      return next
    })
  }

  function isEdited(name: string): boolean {
    return editedFields.has(name)
  }

  function getError(name: string): string | undefined {
    return editedFields.has(name) ? undefined : fieldErrors[name]?.[0]
  }

  return { markEdited, isEdited, getError }
}
