export type AuthState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  values?: Record<string, string>
  // Set by signup when the email is already registered, so the form can link
  // to the password reset page.
  accountExists?: boolean
}

export const initialAuthState: AuthState = { status: 'idle' }
