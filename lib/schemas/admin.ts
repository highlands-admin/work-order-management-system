import * as z from 'zod'

export const APP_ROLES = [
  'administrator',
  'requester',
  'technician',
  'inspector',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export const ROLE_LABELS: Record<AppRole, string> = {
  administrator: 'Administrator',
  requester: 'Requester',
  technician: 'Technician',
  inspector: 'Inspector',
}

const roleSchema = z.enum(APP_ROLES)

export const inviteSchema = z.object({
  email: z.email('Enter a valid email address'),
  role: roleSchema,
  firstName: z.string().trim().max(50).optional().or(z.literal('')),
  lastName: z.string().trim().max(50).optional().or(z.literal('')),
})

export type InviteInput = z.infer<typeof inviteSchema>

export const changeRoleSchema = z.object({
  userId: z.uuid('Invalid user'),
  role: roleSchema,
})

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>

export const invitationIdSchema = z.object({
  invitationId: z.uuid('Invalid invitation'),
})

export type InvitationIdInput = z.infer<typeof invitationIdSchema>
