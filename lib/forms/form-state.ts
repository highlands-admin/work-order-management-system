import type { AuthState } from '@/app/(auth)/auth-state'

export function formError(
  fieldErrors: Record<string, string[]> | undefined,
  values: Record<string, string>,
  message?: string
): AuthState {
  return { status: 'error', fieldErrors, values, message }
}

export function formSuccess(
  message: string,
  values: Record<string, string> = {}
): AuthState {
  return { status: 'success', message, values }
}

// Groups Zod issues by their top-level field for useServerErrors.
export function z4FieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[]
}): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_form')
    if (!result[key]) result[key] = []
    result[key].push(issue.message)
  }
  return result
}
