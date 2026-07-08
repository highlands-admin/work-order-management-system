// Remembered category filter for the dashboard, so every chart -- and the KPI
// tiles -- stay scoped to what a role cares about (e.g. an IT admin pinning
// the dashboard to just IT tickets). Mirrors the list-filters-cookie pattern:
// an explicit ?category in the URL always wins; the cookie is only consulted
// on a visit that carries none. DOM-free except writeDashboardCategoryCookie,
// so the server page can import this module too.

import {
  WORK_ORDER_CATEGORIES,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'

export const DASHBOARD_CATEGORY_COOKIE = 'dashboard_category'

// One year, matching the longevity of the other list-preference cookies.
export const DASHBOARD_FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const CATEGORY_SET = new Set<string>(WORK_ORDER_CATEGORIES)

// Shared by the URL param and the cookie value, which use the same
// comma-separated format.
export function parseCategoryList(raw: string | undefined): WorkOrderCategory[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: WorkOrderCategory[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (CATEGORY_SET.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed)
      out.push(trimmed as WorkOrderCategory)
    }
  }
  return out
}

export function writeDashboardCategoryCookie(
  categories: readonly string[]
): void {
  document.cookie = `${DASHBOARD_CATEGORY_COOKIE}=${categories.join(
    ','
  )}; path=/; max-age=${DASHBOARD_FILTER_COOKIE_MAX_AGE}; samesite=lax`
}
