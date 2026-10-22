import type {
  ITRequestType,
  WorkOrderCategory,
} from '@/lib/schemas/work-order'
import type { AssignableUser } from '@/lib/work-orders/assignable-users'

// Who picks up a work order when nobody is chosen for it, so routed work never
// sits in the live list unowned. Like the category approvers, the people are
// identified by email read from the environment, keeping addresses out of the
// repo. A request-type entry wins over its category's entry. Categories without
// an entry stay unassigned until someone picks an assignee by hand.
const CATEGORY_DEFAULT_ENV: Partial<Record<WorkOrderCategory, string>> = {
  it: 'DEFAULT_ASSIGNEE_EMAIL_IT',
}

const IT_REQUEST_TYPE_DEFAULT_ENV: Partial<Record<ITRequestType, string>> = {
  access_identity: 'DEFAULT_ASSIGNEE_EMAIL_IT_ACCESS_IDENTITY',
}

function emailFromEnv(envVar: string | undefined): string | null {
  if (!envVar) return null
  return process.env[envVar]?.trim().toLowerCase() || null
}

// Returns the default assignee's user id, or null when no default applies (no
// mapping, the environment variable is unset, or no user has that email).
export function resolveDefaultAssignee(
  category: WorkOrderCategory,
  itRequestType: ITRequestType | null | undefined,
  users: AssignableUser[]
): string | null {
  const email =
    (category === 'it' && itRequestType
      ? emailFromEnv(IT_REQUEST_TYPE_DEFAULT_ENV[itRequestType])
      : null) ?? emailFromEnv(CATEGORY_DEFAULT_ENV[category])
  if (!email) return null

  return users.find((u) => u.email?.toLowerCase() === email)?.user_id ?? null
}
