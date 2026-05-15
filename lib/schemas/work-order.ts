import * as z from 'zod'

export const WORK_ORDER_CATEGORIES = [
  'maintenance',
  'it',
  'marketing',
] as const

export type WorkOrderCategory = (typeof WORK_ORDER_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  maintenance: 'Maintenance',
  it: 'IT',
  marketing: 'Marketing',
}

export const WORK_ORDER_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'done',
  'closed',
] as const

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  done: 'Done',
  closed: 'Closed',
}

export const WORK_ORDER_PRIORITIES = [
  'urgent',
  'high',
  'medium',
  'low',
] as const

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number]

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PROPERTIES = [
  'norcross',
  'jefferson',
  'rome',
  'gaston',
  'cartersville',
  'columbia',
  'forest_city',
] as const

export type Property = (typeof PROPERTIES)[number]

export const PROPERTY_LABELS: Record<Property, string> = {
  norcross: 'Norcross',
  jefferson: 'Jefferson',
  rome: 'Rome',
  gaston: 'Gaston',
  cartersville: 'Cartersville',
  columbia: 'Columbia',
  forest_city: 'Forest City',
}

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

export const createWorkOrderSchema = z.object({
  category: z.enum(WORK_ORDER_CATEGORIES, { message: 'Select a category' }),
  priority: z.enum(WORK_ORDER_PRIORITIES, { message: 'Select a priority' }),
  property: z.enum(PROPERTIES, { message: 'Select a property' }),
  unitNumber: trimmedOptional.pipe(z.string().max(10).optional()),
  dueAt: trimmedOptional.pipe(
    z.iso.datetime({ offset: true, message: 'Enter a valid date and time' }).optional()
  ),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(5000, 'Description is too long'),
  reportedByName: trimmedOptional.pipe(z.string().max(100).optional()),
  reportedByEmail: trimmedOptional.pipe(
    z.email('Enter a valid email address').optional()
  ),
  reportedByPhone: trimmedOptional.pipe(z.string().max(30).optional()),
})

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>
