import { startOfToday } from 'date-fns'
import * as z from 'zod'

export const WORK_ORDER_CATEGORIES = [
  'it',
  'marketing',
  'maintenance',
  'preventative_maintenance',
  'license',
  'compliance',
] as const

export type WorkOrderCategory = (typeof WORK_ORDER_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  it: 'IT',
  marketing: 'Marketing',
  maintenance: 'Maintenance',
  preventative_maintenance: 'Preventative Maintenance',
  license: 'License/Permit',
  compliance: 'Compliance/Inspection',
}

// Categories ordered alphabetically by their display label, for rendering
// selectable lists (dropdowns, filters, queue sections) in the frontend.
// WORK_ORDER_CATEGORIES keeps its own order because it backs the Postgres enum.
export const WORK_ORDER_CATEGORIES_BY_LABEL: readonly WorkOrderCategory[] = [
  ...WORK_ORDER_CATEGORIES,
].sort((a, b) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]))

export const WORK_ORDER_STATUSES = [
  'pending',
  'open',
  'in_progress',
  'on_hold',
  'done',
  'closed',
  'rejected',
] as const

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: 'Pending',
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
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
  'on_hold',
  'done',
  'closed',
] as const satisfies readonly WorkOrderStatus[]

// Statuses an administrator may manually reject a work order from -- e.g. one
// an admin created directly, bypassing the approval queue, that another admin
// later decides shouldn't proceed. Done and closed work is already finished,
// so it's excluded; rejecting it would have no meaningful effect.
export const REJECTABLE_MAIN_STATUSES = [
  'open',
  'in_progress',
  'on_hold',
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

// Recurrence cadences for recurring work orders (inspections and licenses).
// Mirrors the recurrence_frequency enum in the database.
export const RECURRENCE_FREQUENCIES = [
  'one_time',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
] as const

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  one_time: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semi-annual',
  annual: 'Annual',
}

// Default number of days before an occurrence's due date to email a reminder.
export const DEFAULT_REMINDER_LEAD_DAYS = 14

// Calendar-style alert lead times offered when setting up a recurring schedule.
// Each value is the number of days before the due date to email an alert.
export const REMINDER_LEAD_OPTIONS = [
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
  { value: 14, label: '2 weeks before' },
  { value: 30, label: '1 month before' },
  { value: 60, label: '2 months before' },
] as const

export const REMINDER_LEAD_LABELS: Record<number, string> = Object.fromEntries(
  REMINDER_LEAD_OPTIONS.map((o) => [o.value, o.label])
)

// Categories that can be made recurring through the form. Inspections and
// licenses are the recurring compliance work; everything else stays one-off.
export const RECURRING_CATEGORIES = new Set<WorkOrderCategory>([
  'license',
  'compliance',
])

// Marketing-specific fields. These are collected only for the 'marketing'
// category and are required when that category is selected. The 'other' values
// reveal a free-text field that captures the detail the fixed options miss.

export const MARKETING_REQUEST_TYPES = [
  'event_flyer',
  'monthly_special',
  'informational_flyer',
  'business_card',
  'other',
] as const

export type MarketingRequestType = (typeof MARKETING_REQUEST_TYPES)[number]

export const MARKETING_REQUEST_TYPE_LABELS: Record<MarketingRequestType, string> = {
  event_flyer: 'Event Flyer',
  monthly_special: 'Monthly Special',
  informational_flyer: 'Informational Flyer',
  business_card: 'Business Card',
  other: 'Other',
}

// A business card needs only the request type. The rest of the marketing brief
// (event name, audience, key message, size/format) is hidden in the form and
// skipped in validation for this request type.
export const MARKETING_BRIEF_EXEMPT_REQUEST_TYPES = new Set<MarketingRequestType>(
  ['business_card']
)

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
  provider: trimmedOptional.pipe(z.string().max(200).optional()),
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
      message: 'Select a facility',
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

    // Business cards skip the rest of the brief; everything else requires it.
    const needsBrief =
      !data.marketingRequestType ||
      !MARKETING_BRIEF_EXEMPT_REQUEST_TYPES.has(data.marketingRequestType)

    if (needsBrief) {
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

// Recurrence is optional. When a frequency is chosen the work order is filed as
// a recurring order: a template is created and its first occurrence is filed
// immediately. The due date doubles as the first occurrence's date, so it is
// required once a frequency is set.
const recurrenceFields = {
  frequency: optionalEnum(RECURRENCE_FREQUENCIES),
  // Calendar-style alerts: zero or more lead times (days before due), deduped.
  reminderLeadDays: z
    .array(z.coerce.number().int().min(0).max(365))
    .optional()
    .transform((v) => (v && v.length > 0 ? Array.from(new Set(v)) : undefined)),
  // People (user ids) who receive the alerts, deduped.
  reminderRecipients: z
    .array(z.uuid())
    .optional()
    .transform((v) => (v && v.length > 0 ? Array.from(new Set(v)) : undefined)),
}

function requireRecurrenceAnchor<
  T extends { frequency?: RecurrenceFrequency; dueAt?: string }
>(data: T, ctx: z.RefinementCtx) {
  if (data.frequency && !data.dueAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['dueAt'],
      message: 'A first due date is required for recurring work orders',
    })
  }
}

// Backstop for the date picker's disablePast restriction -- a new work order
// has no pre-existing due date to protect, so this can reject outright.
// Editing an existing work order deliberately skips this: an already-overdue
// due date must stay saveable when some other field changes.
function requireFutureDueDate<T extends { dueAt?: string }>(
  data: T,
  ctx: z.RefinementCtx
) {
  if (data.dueAt && new Date(data.dueAt) < startOfToday()) {
    ctx.addIssue({
      code: 'custom',
      path: ['dueAt'],
      message: 'Due date cannot be in the past',
    })
  }
}

export const createWorkOrderSchema = z
  .object({ ...baseWorkOrderFields, ...recurrenceFields })
  .superRefine(requirePropertyUnlessIT)
  .superRefine(requireMarketingFields)
  .superRefine(requireRecurrenceAnchor)
  .superRefine(requireFutureDueDate)

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>

// The Validated By field: an optional user id, shaped like the assignee field
// so the same dropdown of users populates it.
const validatedByField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(z.uuid({ message: 'Select who validated this work order' }).optional())

// Editors (admin / requester) may change any field, including status,
// resolution, and the validator. Inputs share the create shape (assignee
// included, which is optional); status, resolution, and validatedBy are
// appended.
export const updateWorkOrderSchema = z
  .object({
    ...baseWorkOrderFields,
    status: z.enum(WORK_ORDER_STATUSES, { message: 'Select a status' }),
    resolution: trimmedOptional.pipe(z.string().max(5000).optional()),
    validatedBy: validatedByField,
  })
  .superRefine(requirePropertyUnlessIT)
  .superRefine(requireMarketingFields)
  .superRefine(requireResolutionOnDone)
  .superRefine(requireResolutionOnClosed)
  .superRefine(requireValidatedByOnClosed)

export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>

// Editing a recurring schedule (the template). Covers the schedule's own fields
// plus its cadence, alerts, recipients, and active state. dueAt is the next
// occurrence's date and is required.
export const updateRecurringWorkOrderSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
    category: z.enum(WORK_ORDER_CATEGORIES, { message: 'Select a category' }),
    priority: z.enum(WORK_ORDER_PRIORITIES, { message: 'Select a priority' }),
    property: optionalProperty,
    unitNumber: trimmedOptional.pipe(z.string().max(10).optional()),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(5000, 'Description is too long'),
    provider: trimmedOptional.pipe(z.string().max(200).optional()),
    assignedTo: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .pipe(z.uuid({ message: 'Select a valid assignee' }).optional()),
    frequency: z.enum(RECURRENCE_FREQUENCIES, { message: 'Select a frequency' }),
    dueAt: trimmedOptional.pipe(
      z.iso.datetime({ offset: true, message: 'Enter a valid date and time' }).optional()
    ),
    reminderLeadDays: z
      .array(z.coerce.number().int().min(0).max(365))
      .optional()
      .transform((v) => (v && v.length > 0 ? Array.from(new Set(v)) : undefined)),
    reminderRecipients: z
      .array(z.uuid())
      .optional()
      .transform((v) => (v && v.length > 0 ? Array.from(new Set(v)) : undefined)),
    active: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
  })
  .superRefine(requirePropertyUnlessIT)
  .superRefine((data, ctx) => {
    if (!data.dueAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'A next due date is required',
      })
    }
  })

export type UpdateRecurringWorkOrderInput = z.infer<
  typeof updateRecurringWorkOrderSchema
>

// Marking a work order Done requires a resolution describing how it was
// completed. Shared by the two status-change paths below.
function requireResolutionOnDone<
  T extends { status: WorkOrderStatus; resolution?: string }
>(data: T, ctx: z.RefinementCtx) {
  if (data.status === 'done' && !data.resolution) {
    ctx.addIssue({
      code: 'custom',
      path: ['resolution'],
      message: 'A resolution is required to mark a work order done.',
    })
  }
}

// Closing a work order requires recording who validated the completed work.
function requireValidatedByOnClosed<
  T extends { status: WorkOrderStatus; validatedBy?: string }
>(data: T, ctx: z.RefinementCtx) {
  if (data.status === 'closed' && !data.validatedBy) {
    ctx.addIssue({
      code: 'custom',
      path: ['validatedBy'],
      message: 'Select who validated this work order to close it.',
    })
  }
}

// Closing also requires a resolution. Used where the resolution is entered on
// the same form (the full edit form). The imperative status paths check the
// existing resolution in the action instead, since a done work order already
// has one.
function requireResolutionOnClosed<
  T extends { status: WorkOrderStatus; resolution?: string }
>(data: T, ctx: z.RefinementCtx) {
  if (data.status === 'closed' && !data.resolution) {
    ctx.addIssue({
      code: 'custom',
      path: ['resolution'],
      message: 'A resolution is required to close a work order.',
    })
  }
}

// Status-only transitions for technicians and inspectors. The action checks the
// caller's role against the target status; RLS and a trigger enforce the same
// rules at the database boundary. A resolution is required (and permitted) when
// a technician completes the work (in_progress -> done).
export const transitionStatusSchema = z
  .object({
    status: z.enum(WORK_ORDER_STATUSES, { message: 'Select a status' }),
    resolution: trimmedOptional.pipe(z.string().max(5000).optional()),
    validatedBy: validatedByField,
  })
  .superRefine(requireResolutionOnDone)
  .superRefine(requireValidatedByOnClosed)

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>

// Inline status change from the detail page and kanban board: admins, assignees,
// and creators move an approved work order between the main workflow statuses.
// Moving to Done requires a resolution; moving to Closed requires a validator
// (and a resolution, which the action supplies from the existing row when the
// work order is already Done).
export const changeStatusSchema = z
  .object({
    status: z.enum(MAIN_TABLE_STATUSES, { message: 'Select a status' }),
    resolution: trimmedOptional.pipe(z.string().max(5000).optional()),
    validatedBy: validatedByField,
  })
  .superRefine(requireResolutionOnDone)
  .superRefine(requireValidatedByOnClosed)

export const addWorkOrderNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(10000, 'Note is too long (max 10,000 characters)'),
})

export type AddWorkOrderNoteInput = z.infer<typeof addWorkOrderNoteSchema>
