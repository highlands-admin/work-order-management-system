import * as z from 'zod'

const email = z
  .email('Enter a valid email address')
  .transform((v) => v.trim().toLowerCase())

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must not exceed 72 characters')
  .regex(/\p{Ll}/u, 'Password must contain a lowercase letter')
  .regex(/\p{Lu}/u, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^\p{L}\p{N}]/u, 'Password must contain a special character')

const otp = z
  .string()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email')

// Shape-only guard. Real validity is decided by the DB lookup in invitation_by_token.
// Generated tokens are 48 hex chars (randomBytes(24).toString('hex')); the bootstrap admin
// migration uses a short sentinel, so we accept any URL-safe string of reasonable length.
const inviteToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, 'Invalid invitation token')

export const acceptInviteSchema = z
  .object({
    token: inviteToken,
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    lastName: z.string().trim().min(1, 'Last name is required').max(50),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>

// Public self-signup. The account is created with email confirmation, and the
// signup trigger assigns the default 'requester' role. Open signup is
// restricted to the organization's email domain; the DB trigger enforces the
// same rule so the form cannot be bypassed.
export const SIGNUP_EMAIL_DOMAIN = 'highlands.care'

export const signUpSchema = z
  .object({
    email,
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    lastName: z.string().trim().min(1, 'Last name is required').max(50),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.email.endsWith(`@${SIGNUP_EMAIL_DOMAIN}`), {
    message: `Sign up requires a @${SIGNUP_EMAIL_DOMAIN} email address.`,
    path: ['email'],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type SignUpInput = z.infer<typeof signUpSchema>

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const verifySchema = z.object({
  email,
  token: otp,
})

export type VerifyInput = z.infer<typeof verifySchema>

export const forgotPasswordSchema = z.object({
  email,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const updatePasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
