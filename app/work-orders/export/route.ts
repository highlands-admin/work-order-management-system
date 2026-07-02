import { NextResponse, type NextRequest } from 'next/server'

import { formatDateTime } from '@/lib/datetime/format'
import { getTimeZone } from '@/lib/datetime/timezone'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { applyWorkOrderFilters } from '@/lib/work-orders/apply-filters'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'
import { parseWorkOrderFilters } from '@/lib/work-orders/filters'

// A CSV download needs to set Content-Disposition, so it lives in a route
// handler rather than a Server Action. It mirrors the /work-orders list query
// (same filters, same pending/rejected exclusion) so the file matches what the
// table shows. RLS scopes the rows to what the signed-in user may see.
export async function GET(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const { data: claimData } = await supabase.auth.getClaims()
  if (!claimData?.claims) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const filters = parseWorkOrderFilters(request.nextUrl.searchParams)

  let query = supabase
    .from('work_orders')
    .select(
      'work_order_code, title, category, status, priority, property, unit_number, assigned_to, reported_by_name, due_at, created_at'
    )
    .not('status', 'in', '(pending,rejected)')
    .order('created_at', { ascending: false })

  query = applyWorkOrderFilters(query, filters)

  const [{ data, error }, assignableUsers, timeZone] = await Promise.all([
    query,
    fetchAssignableUsers(supabase),
    getTimeZone(),
  ])

  if (error) {
    return new NextResponse(`Failed to export: ${error.message}`, {
      status: 500,
    })
  }

  const userLabelById = new Map(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )

  const header = [
    'Code',
    'Title',
    'Category',
    'Status',
    'Priority',
    'Facility',
    'Unit',
    'Assigned To',
    'Reported By',
    'Due',
    'Created',
  ]

  const lines = (data ?? []).map((row) =>
    [
      row.work_order_code ?? '',
      row.title ?? '',
      CATEGORY_LABELS[row.category as WorkOrderCategory] ?? row.category ?? '',
      STATUS_LABELS[row.status as WorkOrderStatus] ?? row.status ?? '',
      PRIORITY_LABELS[row.priority as WorkOrderPriority] ?? row.priority ?? '',
      PROPERTY_LABELS[row.property as Property] ?? row.property ?? '',
      row.unit_number ?? '',
      row.assigned_to ? (userLabelById.get(row.assigned_to) ?? '') : '',
      row.reported_by_name ?? '',
      row.due_at ? formatDateTime(row.due_at, timeZone) : '',
      row.created_at ? formatDateTime(row.created_at, timeZone) : '',
    ]
      .map(toCsvField)
      .join(',')
  )

  const csv = [header.map(toCsvField).join(','), ...lines].join('\r\n')
  const filename = `work-orders-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// Quote every field and escape embedded quotes so commas, newlines, and quotes
// in titles do not break the CSV structure.
function toCsvField(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`
}
