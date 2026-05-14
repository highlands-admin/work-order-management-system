import * as z from 'zod'

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character')

const otp = z
  .string()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email')

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
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
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const verifySchema = z.object({
  email: z.email(),
  token: otp,
})

export type VerifyInput = z.infer<typeof verifySchema>

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const verifyResetOtpSchema = z.object({
  email: z.email(),
  token: otp,
})

export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>

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
