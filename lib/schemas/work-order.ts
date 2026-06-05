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
  'in_progress',
  'done',
  'closed',
  'rejected',
] as const

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: 'Pending',
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
  closed: 'Closed',
  rejected: 'Rejected',
}

// Statuses an editor may move a work order between once it is approved and in
// the main table. Pending and rejected belong to the submission/approval flow,
// and assigned is not part of the editor's manual workflow.
export const MAIN_TABLE_STATUSES = [
  'open',
  'in_progress',
  'done',
  'closed',
] as const satisfies readonly WorkOrderStatus[]

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

// Marketing-specific fields. These are collected only for the 'marketing'
// category and are required when that category is selected. The 'other' values
// reveal a free-text field that captures the detail the fixed options miss.

export const MARKETING_REQUEST_TYPES = [
  'event_flyer',
  'monthly_special',
  'informational_flyer',
  'other',
] as const

export type MarketingRequestType = (typeof MARKETING_REQUEST_TYPES)[number]

export const MARKETING_REQUEST_TYPE_LABELS: Record<MarketingRequestType, string> = {
  event_flyer: 'Event Flyer',
  monthly_special: 'Monthly Special',
  informational_flyer: 'Informational Flyer',
  other: 'Other',
}

export const MARKETING_TARGET_AUDIENCES = [
  'residents',
  'families',
  'potential_residents',
  'staff',
  'community_public',
  'other',
] as const

export type MarketingTargetAudience = (typeof MARKETING_TARGET_AUDIENCES)[number]

export const MARKETING_TARGET_AUDIENCE_LABELS: Record<
  MarketingTargetAudience,
  string
> = {
  residents: 'Residents',
  families: 'Families',
  potential_residents: 'Potential Residents',
  staff: 'Staff',
  community_public: 'Community / Public',
  other: 'Other',
}

export const MARKETING_SIZE_FORMATS = [
  'letter',
  'half_sheet',
  'social_media_post',
  'social_media_story',
  'email',
  'other',
] as const

export type MarketingSizeFormat = (typeof MARKETING_SIZE_FORMATS)[number]

export const MARKETING_SIZE_FORMAT_LABELS: Record<MarketingSizeFormat, string> = {
  letter: 'Letter (8.5 x 11)',
  half_sheet: 'Half Sheet',
  social_media_post: 'Social Media Post',
  social_media_story: 'Social Media Story',
  email: 'Email',
  other: 'Other',
}

// Replaces the description placeholder when the marketing category is
// selected, so requesters know what production details to include.
export const MARKETING_DESCRIPTION_PLACEHOLDER =
  'If it is an event, please list the time, location, and date of the event. It would help to know if a call to action should be included (e.g., RSVP, Call Today, Join Us, Learn More) and who the point of contact is, along with their information that should appear in this graphic.'

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

// Marketing selects arrive as a possibly empty string when the field is hidden
// for non-marketing categories. Empty becomes undefined, then the enum check
// runs. The superRefine below rejects undefined for marketing work orders.
function optionalEnum<const T extends readonly [string, ...string[]]>(
  values: T
) {
  return z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.enum(values).optional())
}

// Marketing multi-selects arrive as an array (possibly empty) from the checkbox
// group. Empty becomes undefined so the superRefine below can require at least
// one value for marketing work orders.
function optionalEnumArray<const T extends readonly [string, ...string[]]>(
  values: T
) {
  return z
    .array(z.enum(values))
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
}

const baseWorkOrderFields = {
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Title is too long'),
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
  assignedTo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.uuid({ message: 'Select a valid assignee' }).optional()),
  reportedByName: trimmedOptional.pipe(z.string().max(100).optional()),
  reportedByEmail: trimmedOptional.pipe(
    z.email('Enter a valid email address').optional()
  ),
  reportedByPhone: trimmedOptional.pipe(z.string().max(30).optional()),
  marketingRequestType: optionalEnum(MARKETING_REQUEST_TYPES),
  marketingRequestTypeOther: trimmedOptional.pipe(z.string().max(200).optional()),
  marketingEventName: trimmedOptional.pipe(z.string().max(200).optional()),
  marketingTargetAudience: optionalEnumArray(MARKETING_TARGET_AUDIENCES),
  marketingTargetAudienceOther: trimmedOptional.pipe(
    z.string().max(200).optional()
  ),
  marketingKeyMessage: trimmedOptional.pipe(z.string().max(2000).optional()),
  marketingSizeFormat: optionalEnumArray(MARKETING_SIZE_FORMATS),
  marketingSizeFormatOther: trimmedOptional.pipe(z.string().max(200).optional()),
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

// Marketing work orders require their extra fields. The 'other' free-text
// detail is required only when the matching 'other' option is chosen, so a
// non-marketing work order that happens to carry stray marketing values still
// validates.
function requireMarketingFields<
  T extends {
    category: WorkOrderCategory
    marketingRequestType?: MarketingRequestType
    marketingRequestTypeOther?: string
    marketingEventName?: string
    marketingTargetAudience?: MarketingTargetAudience[]
    marketingTargetAudienceOther?: string
    marketingKeyMessage?: string
    marketingSizeFormat?: MarketingSizeFormat[]
    marketingSizeFormatOther?: string
  }
>(data: T, ctx: z.RefinementCtx) {
  if (data.category === 'marketing') {
    if (!data.marketingRequestType) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingRequestType'],
        message: 'Select a type of request',
      })
    }
    if (!data.marketingEventName) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingEventName'],
        message: 'Enter a name or title (or NA)',
      })
    }
    if (!data.marketingTargetAudience) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingTargetAudience'],
        message: 'Select at least one audience',
      })
    }
    if (!data.marketingKeyMessage) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingKeyMessage'],
        message: 'Enter the key message or theme',
      })
    }
    if (!data.marketingSizeFormat) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingSizeFormat'],
        message: 'Select a size or format',
      })
    }
  }

  if (data.marketingRequestType === 'other' && !data.marketingRequestTypeOther) {
    ctx.addIssue({
      code: 'custom',
      path: ['marketingRequestTypeOther'],
      message: 'Describe the type of request',
    })
  }
  if (
    data.marketingTargetAudience?.includes('other') &&
    !data.marketingTargetAudienceOther
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['marketingTargetAudienceOther'],
      message: 'Describe the other audience',
    })
  }
  if (
    data.marketingSizeFormat?.includes('other') &&
    !data.marketingSizeFormatOther
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['marketingSizeFormatOther'],
      message: 'Describe the size or format',
    })
  }
}

export const createWorkOrderSchema = z
  .object(baseWorkOrderFields)
  .superRefine(requirePropertyUnlessIT)
  .superRefine(requireMarketingFields)

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>

// Editors (admin / requester) may change any field, including status and
// resolution. Inputs share the create shape (assignee included, which is
// optional); status and resolution are appended.
export const updateWorkOrderSchema = z
  .object({
    ...baseWorkOrderFields,
    status: z.enum(WORK_ORDER_STATUSES, { message: 'Select a status' }),
    resolution: trimmedOptional.pipe(z.string().max(5000).optional()),
  })
  .superRefine(requirePropertyUnlessIT)
  .superRefine(requireMarketingFields)

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
