import type { WorkOrderCategory } from '@/lib/schemas/work-order'

export type CategoryApprover = {
  name: string
  email: string
}

// Categories routed to a dedicated approver who is emailed when a work order in
// that category enters the approval queue. The display name is stable config;
// the address is read from the environment so it stays out of the repo and can
// differ per deployment. Categories without an entry have no dedicated approver
// and rely on administrators watching the queue.
const APPROVER_ENV: Partial<
  Record<WorkOrderCategory, { name: string; envVar: string }>
> = {
  maintenance: { name: 'Walter Grimes', envVar: 'APPROVER_EMAIL_MAINTENANCE' },
  it: { name: 'Steven Brooks', envVar: 'APPROVER_EMAIL_IT' },
  marketing: { name: 'Marissa Rampley', envVar: 'APPROVER_EMAIL_MARKETING' },
}

// Resolves the approver for a category, or null when none is configured (no
// mapping, or the environment variable is unset). The caller treats null as
// "no notification to send".
export function getCategoryApprover(
  category: WorkOrderCategory
): CategoryApprover | null {
  const config = APPROVER_ENV[category]
  if (!config) return null

  const email = process.env[config.envVar]?.trim()
  if (!email) return null

  return { name: config.name, email }
}
