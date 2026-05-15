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

// Invitation tokens are generated as randomBytes(24).toString('hex') = 48 lowercase hex chars.
const inviteToken = z
  .string()
  .regex(/^[a-f0-9]{48}$/, 'Invalid invitation token')

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
