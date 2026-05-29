import * as z from 'zod'

export const WORK_ORDER_CATEGORIES = [
  'maintenance',
  'it',
  'marketing',
  'license',
  'compliance',
] as const

export type WorkOrderCategory = (typeof WORK_ORDER_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  maintenance: 'Maintenance',
  it: 'IT',
  marketing: 'Marketing',
  license: 'License',
  compliance: 'Compliance',
}

export const WORK_ORDER_STATUSES = [
  'pending',
  'open',
  'assigned',
  'in_progress',
  'done',
  'closed',
  'rejected',
] as const

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: 'Pending',
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  done: 'Done',
  closed: 'Closed',
  rejected: 'Rejected',
}

// Roles whose submissions need administrator approval before joining the
// main work-order flow. Admins bypass this and create work orders directly.
export const APPROVAL_REQUIRED_ROLES = new Set(['requester'] as const)

export const rejectWorkOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Provide a reason for rejection')
    .max(2000, 'Reason is too long'),
})

export type RejectWorkOrderInput = z.infer<typeof rejectWorkOrderSchema>

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

// Property is required for every category except IT. We let the field arrive
// as an empty string (the case when the form hides the select for IT) or as
// a real enum value; refinement below rejects empty for non-IT.
const optionalProperty = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(z.enum(PROPERTIES).optional())

const baseWorkOrderFields = {
  category: z.enum(WORK_ORDER_CATEGORIES, { message: 'Select a category' }),
  priority: z.enum(WORK_ORDER_PRIORITIES, { message: 'Select a priority' }),
  property: optionalProperty,
  unitNumber: trimmedOptional.pipe(z.string().max(10).optional()),
  dueAt: trimmedOptional.pipe(
    z.iso.datetime({ offset: true, message: 'Enter a valid date and time' }).optional()
  ),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(5000, 'Description is too long'),
  assignedTo: z.uuid({ message: 'Select an assignee' }),
  reportedByName: trimmedOptional.pipe(z.string().max(100).optional()),
  reportedByEmail: trimmedOptional.pipe(
    z.email('Enter a valid email address').optional()
  ),
  reportedByPhone: trimmedOptional.pipe(z.string().max(30).optional()),
}

function requirePropertyUnlessIT<
  T extends { category: WorkOrderCategory; property?: Property }
>(data: T, ctx: z.RefinementCtx) {
  if (data.category !== 'it' && !data.property) {
    ctx.addIssue({
      code: 'custom',
      path: ['property'],
      message: 'Select a property',
    })
  }
}

export const createWorkOrderSchema = z
  .object(baseWorkOrderFields)
  .superRefine(requirePropertyUnlessIT)

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>

// Editors (admin / requester) may change any field, including status and
// resolution. Inputs share the create shape; status and resolution are
// appended.
export const updateWorkOrderSchema = z
  .object({
    ...baseWorkOrderFields,
    status: z.enum(WORK_ORDER_STATUSES, { message: 'Select a status' }),
    resolution: trimmedOptional.pipe(z.string().max(5000).optional()),
  })
  .superRefine(requirePropertyUnlessIT)

export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>

// Status-only transitions for technicians and inspectors. The action checks the
// caller's role against the target status; RLS and a trigger enforce the same
// rules at the database boundary.
export const transitionStatusSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES, { message: 'Select a status' }),
})

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>

export const addWorkOrderNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(2000, 'Note is too long (max 2000 characters)'),
})

export type AddWorkOrderNoteInput = z.infer<typeof addWorkOrderNoteSchema>
