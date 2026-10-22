import type { Metadata } from 'next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CATEGORY_LABELS,
  IT_REQUEST_TYPE_LABELS,
  IT_REQUEST_TYPES,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  type ITRequestType,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'

import { DefaultAssigneeSelect } from './default-assignee-select'

export const metadata: Metadata = { title: 'Default Assignees' }

type DefaultAssigneeRow = {
  category: WorkOrderCategory
  it_request_type: string | null
  user_id: string
}

// Key for one slot: a category default, or an IT request type override.
function slotKey(category: WorkOrderCategory, type: string | null): string {
  return `${category}:${type ?? ''}`
}

export default async function DefaultAssigneesPage() {
  const supabase = await createClient()

  const [users, defaultsResult] = await Promise.all([
    fetchAssignableUsers(supabase),
    supabase
      .from('default_assignees')
      .select('category, it_request_type, user_id'),
  ])

  const options = users
    .map((u) => ({ value: u.user_id, label: formatAssigneeLabel(u) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const userBySlot = new Map<string, string>()
  for (const row of (defaultsResult.data ?? []) as DefaultAssigneeRow[]) {
    userBySlot.set(slotKey(row.category, row.it_request_type), row.user_id)
  }

  const cellClass = 'px-4 py-3'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Default Assignees
        </h1>
        <p className="text-sm text-muted-foreground">
          Who picks up a work order when it goes live with nobody assigned:
          when an administrator files one without an assignee, or approves a
          submission without picking one. The person is emailed like any other
          assignment. Choosing an assignee by hand always wins.
        </p>
      </div>

      {defaultsResult.error ? (
        <p className="text-sm text-destructive">
          {defaultsResult.error.message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                Default Assignee
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {WORK_ORDER_CATEGORIES_BY_LABEL.flatMap((category) => {
              const rows = [
                <TableRow key={slotKey(category, null)}>
                  <TableCell className={cellClass}>
                    {CATEGORY_LABELS[category]}
                  </TableCell>
                  <TableCell className={cellClass}>
                    <DefaultAssigneeSelect
                      category={category}
                      itRequestType={null}
                      initialUserId={
                        userBySlot.get(slotKey(category, null)) ?? null
                      }
                      options={options}
                      emptyLabel="No default"
                    />
                  </TableCell>
                </TableRow>,
              ]
              // IT work orders carry a type of request, and each type can be
              // routed to someone other than the IT default.
              if (category === 'it') {
                rows.push(
                  ...IT_REQUEST_TYPES.map((type: ITRequestType) => (
                    <TableRow key={slotKey(category, type)}>
                      <TableCell
                        className={`${cellClass} pl-8 text-muted-foreground`}
                      >
                        {IT_REQUEST_TYPE_LABELS[type]}
                      </TableCell>
                      <TableCell className={cellClass}>
                        <DefaultAssigneeSelect
                          category={category}
                          itRequestType={type}
                          initialUserId={
                            userBySlot.get(slotKey(category, type)) ?? null
                          }
                          options={options}
                          emptyLabel="Same as IT default"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )
              }
              return rows
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
