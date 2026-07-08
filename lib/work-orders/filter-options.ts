// Shared option lists for the work-order filter facets, used by both the
// Filters panel (FilterBar) and each table's per-column filter icons, so the
// two stay in sync without duplicating the same enum-to-Option mapping twice.

import type { Option } from '@/components/ui/multi-select-filter'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTIES,
  PROPERTY_LABELS,
  STATUS_LABELS,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

// pending/rejected work orders live on /work-orders/submissions, so the
// status facet on the main lists only exposes the approved-stage statuses.
export const STATUS_OPTIONS: Option<WorkOrderStatus>[] = WORK_ORDER_STATUSES.filter(
  (s) => s !== 'pending' && s !== 'rejected'
).map((v) => ({ value: v, label: STATUS_LABELS[v] }))

export const PRIORITY_OPTIONS: Option<WorkOrderPriority>[] =
  WORK_ORDER_PRIORITIES.map((v) => ({ value: v, label: PRIORITY_LABELS[v] }))

export const CATEGORY_OPTIONS: Option<WorkOrderCategory>[] =
  WORK_ORDER_CATEGORIES_BY_LABEL.map((v) => ({ value: v, label: CATEGORY_LABELS[v] }))

export const PROPERTY_OPTIONS: Option<Property>[] = PROPERTIES.map((v) => ({
  value: v,
  label: PROPERTY_LABELS[v],
}))
