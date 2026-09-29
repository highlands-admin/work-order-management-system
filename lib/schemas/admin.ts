import * as z from 'zod'

import { WORK_ORDER_CATEGORIES } from '@/lib/schemas/work-order'
import { PROPERTY_KEY_PATTERN } from '@/lib/work-orders/properties'

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

// The full set of approvers for a category. An empty list clears it.
export const setCategoryApproversSchema = z.object({
  category: z.enum(WORK_ORDER_CATEGORIES),
  userIds: z.array(z.uuid('Invalid user')).max(50),
})

export type SetCategoryApproversInput = z.infer<
  typeof setCategoryApproversSchema
>

const propertyNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(60, 'Keep the name under 60 characters')

const propertyKeySchema = z.string().regex(PROPERTY_KEY_PATTERN, 'Invalid property')

export const addPropertySchema = z.object({
  name: propertyNameSchema,
})

export const renamePropertySchema = z.object({
  key: propertyKeySchema,
  name: propertyNameSchema,
})

export const setPropertyActiveSchema = z.object({
  key: propertyKeySchema,
  isActive: z.boolean(),
})
