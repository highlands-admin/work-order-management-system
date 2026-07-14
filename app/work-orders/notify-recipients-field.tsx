'use client'

import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from '@remixicon/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

// A searchable multi-select for the users who should receive in-app
// notifications for every update to this work order, in addition to the
// assignee. Chosen people show as removable chips; selections submit as
// repeated hidden `notifyRecipients` fields, read with formData.getAll.
export function NotifyRecipientsField({
  users,
  defaultValue,
}: {
  users: AssignableUser[]
  defaultValue: string[]
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue)
  const [query, setQuery] = useState('')
  // The keyboard-highlighted row, so a result can be picked with Enter. Resets
  // to the first result whenever the query changes.
  const [activeIndex, setActiveIndex] = useState(0)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.user_id, u])),
    [users]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => formatAssigneeLabel(u).toLowerCase().includes(q))
  }, [users, query])

  // Keep the highlighted row visible as the user arrows through the list.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function changeQuery(next: string) {
    setQuery(next)
    setActiveIndex(0)
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
    // Clear the search so the full list is ready for the next pick.
    setQuery('')
    setActiveIndex(0)
  }

  // Arrow keys move the highlight; Enter picks it. Enter is also swallowed so it
  // never submits the outer form.
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const user = filtered[activeIndex]
      if (user) toggle(user.user_id)
    }
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((r) => r !== id))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        Recipients{' '}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </span>
      <p className="text-sm text-muted-foreground">
        Recipients get notified of every update to this work order, just like the
        assignee.
      </p>

      {/* Submitted values */}
      {selected.map((id) => (
        <input key={id} type="hidden" name="notifyRecipients" value={id} />
      ))}

      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 justify-start gap-1.5 font-normal text-muted-foreground sm:max-w-sm"
              disabled={users.length === 0}
            >
              <RiAddLine className="size-4" aria-hidden="true" />
              {users.length === 0 ? 'No users available' : 'Add recipients'}
              {selected.length > 0 ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
                  {selected.length}
                </span>
              ) : null}
            </Button>
          }
        />
        <PopoverContent
          // Never taller than the space the popover has on screen; the list
          // scrolls inside instead of running past the page.
          className="flex max-h-[min(20rem,var(--available-height,20rem))] w-72 flex-col gap-0 overflow-hidden p-0"
          align="start"
        >
          <div className="relative shrink-0 border-b p-1.5">
            <RiSearchLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search people"
              aria-label="Search people"
              className="h-8 border-0 pl-8 shadow-none focus-visible:ring-0"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                No people match.
              </li>
            ) : (
              filtered.map((u, index) => {
                const isSelected = selected.includes(u.user_id)
                const isActive = index === activeIndex
                return (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      ref={isActive ? activeRef : undefined}
                      onClick={() => toggle(u.user_id)}
                      onMouseMove={() => setActiveIndex(index)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                        isActive && 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
                          isSelected
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-input'
                        )}
                      >
                        {isSelected ? (
                          <RiCheckLine className="size-3" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="truncate">{formatAssigneeLabel(u)}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const user = usersById.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-sm"
              >
                <span className="truncate">
                  {user ? formatAssigneeLabel(user) : id}
                </span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Remove ${user ? formatAssigneeLabel(user) : 'recipient'}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <RiCloseLine className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
