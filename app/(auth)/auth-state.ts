export type AuthState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  values?: Record<string, string>
}

export const initialAuthState: AuthState = { status: 'idle' }
