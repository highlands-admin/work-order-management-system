import type { Metadata } from 'next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type AppRole } from '@/lib/schemas/admin'
import {
  CATEGORY_LABELS,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { formatAssigneeLabel } from '@/lib/work-orders/assignable-users'

import { ApproversMultiSelect } from './approvers-multi-select'

export const metadata: Metadata = { title: 'Approvers' }

type AdminUserRow = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: AppRole | null
}

type ApproverRow = {
  category: WorkOrderCategory
  user_id: string
}

export default async function ApproversPage() {
  const supabase = await createClient()

  const [usersResult, approversResult] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.from('category_approvers').select('category, user_id'),
  ])

  const administrators = ((usersResult.data ?? []) as AdminUserRow[])
    .filter((u) => u.role === 'administrator')
    .map((u) => ({ value: u.user_id, label: formatAssigneeLabel(u) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Rows for users who have since lost the administrator role are left out.
  // They no longer receive emails, and the next save for that category removes
  // them.
  const administratorIds = new Set(administrators.map((a) => a.value))
  const approversByCategory = new Map<WorkOrderCategory, string[]>()
  for (const row of (approversResult.data ?? []) as ApproverRow[]) {
    if (!administratorIds.has(row.user_id)) continue
    const list = approversByCategory.get(row.category) ?? []
    list.push(row.user_id)
    approversByCategory.set(row.category, list)
  }

  const error = usersResult.error ?? approversResult.error

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Approvers</h1>
        <p className="text-sm text-muted-foreground">
          The administrators emailed when a submission in each category enters
          the approval queue. Categories without approvers rely on
          administrators checking the queue.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                Approvers
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {WORK_ORDER_CATEGORIES_BY_LABEL.map((category) => (
              <TableRow key={category}>
                <TableCell className="px-4 py-3">
                  {CATEGORY_LABELS[category]}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <ApproversMultiSelect
                    category={category}
                    initialUserIds={approversByCategory.get(category) ?? []}
                    options={administrators}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
