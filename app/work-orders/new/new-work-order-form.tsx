'use client'

import { RiCheckLine } from '@remixicon/react'
import {
  useActionState,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import {
  CATEGORY_LABELS,
  FREQUENCY_LABELS,
  MARKETING_BRIEF_EXEMPT_REQUEST_TYPES,
  MARKETING_DESCRIPTION_PLACEHOLDER,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  RECURRENCE_FREQUENCIES,
  RECURRING_CATEGORIES,
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  PROPERTIES,
  type MarketingRequestType,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'

import {
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

import { initialAuthState } from '../../(auth)/auth-state'
import { createWorkOrderAction } from '../actions'
import { MarketingFields, emptyMarketingDefaults } from '../marketing-fields'
import { RecurrenceReminders } from './recurrence-reminders'

const DESCRIPTION_PLACEHOLDER =
  'What needs to be done? Include anything a technician should know.'

// Each step lists the field names it owns, so a server-side validation error can
// send the user back to the step that contains the offending field.
const STEPS = [
  { title: 'Basics', fields: ['title', 'category', 'priority'] },
  {
    title: 'Details',
    fields: [
      'description',
      'dueAt',
      'frequency',
      'reminderLeadDays',
      'provider',
      'marketingRequestType',
      'marketingRequestTypeOther',
      'marketingEventName',
      'marketingTargetAudience',
      'marketingTargetAudienceOther',
      'marketingKeyMessage',
      'marketingSizeFormat',
      'marketingSizeFormatOther',
    ],
  },
  { title: 'Location', fields: ['property', 'unitNumber', 'assignedTo'] },
  {
    title: 'Reporter',
    fields: ['reportedByName', 'reportedByEmail', 'reportedByPhone'],
  },
] as const

const LAST_STEP = STEPS.length - 1

type ReporterDefaults = {
  name?: string
  email?: string
  phone?: string
}

export function NewWorkOrderForm({
  reporterDefaults,
  assignableUsers,
}: {
  reporterDefaults?: ReporterDefaults
  assignableUsers: AssignableUser[]
}) {
  // Value -> label maps let the Select render the chosen option's label (not the
  // raw stored value) without the dropdown items being mounted, and still show
  // the placeholder when nothing is selected.
  const assigneeItems = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const [state, action] = useActionState(
    createWorkOrderAction,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)

  // Notes are kept in local state so they survive failed form submissions.
  const [notes, setNotes] = useState<string[]>([])

  // Seed recurrence reminder defaults: a single 2-week alert on a fresh form, or
  // the echoed values after a failed submit so selections survive validation.
  const reminderLeadDefaults =
    state.values?.reminderLeadDays === undefined
      ? [14]
      : state.values.reminderLeadDays
          .split(',')
          .filter(Boolean)
          .map(Number)
  const reminderRecipientDefaults = (state.values?.reminderRecipients ?? '')
    .split(',')
    .filter(Boolean)
  const [step, setStep] = useState(0)
  // Client-side validation errors for the current step. Merged with server
  // errors for display, and cleared as the user edits each field.
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)

  // Selects must be controlled so Base UI doesn't warn when state.values flips
  // from undefined (first render) to a string (after a failed submission).
  // Reset to the latest server values whenever a new action state arrives.
  const [storedState, setStoredState] = useState(state)
  const [categoryValue, setCategoryValue] = useState<string>(
    state.values?.category ?? ''
  )
  const [priorityValue, setPriorityValue] = useState<string>(
    state.values?.priority ?? ''
  )
  const [propertyValue, setPropertyValue] = useState<string>(
    state.values?.property ?? ''
  )
  const [assignedToValue, setAssignedToValue] = useState<string>(
    state.values?.assignedTo ?? ''
  )
  const [frequencyValue, setFrequencyValue] = useState<string>(
    state.values?.frequency ?? ''
  )
  if (storedState !== state) {
    setStoredState(state)
    setStepErrors({})
    setCategoryValue(state.values?.category ?? '')
    setPriorityValue(state.values?.priority ?? '')
    setPropertyValue(state.values?.property ?? '')
    setAssignedToValue(state.values?.assignedTo ?? '')
    setFrequencyValue(state.values?.frequency ?? '')
    // After a failed submit, jump to the first step that has an error so the
    // user sees what needs fixing.
    if (state.status === 'error' && state.fieldErrors) {
      const fieldErrors = state.fieldErrors
      const errorStep = STEPS.findIndex((s) =>
        s.fields.some((f) => fieldErrors[f])
      )
      if (errorStep >= 0) setStep(errorStep)
    }
  }

  // Required-field checks for one step. Returns a map of field -> message. The
  // server still re-validates everything on submit; this just gates navigation.
  function validateStep(index: number, fd: FormData): Record<string, string> {
    const errors: Record<string, string> = {}
    const val = (name: string) => String(fd.get(name) ?? '').trim()

    if (index === 0) {
      if (!val('title')) errors.title = 'Title is required'
      if (!val('category')) errors.category = 'Select a category'
      if (!val('priority')) errors.priority = 'Select a priority'
    } else if (index === 1) {
      if (!val('description')) errors.description = 'Description is required'
      if (
        RECURRING_CATEGORIES.has(categoryValue as WorkOrderCategory) &&
        val('frequency') &&
        !val('dueAt')
      ) {
        errors.dueAt = 'A first due date is required for recurring work orders'
      }
      if (categoryValue === 'marketing') {
        const requestType = val('marketingRequestType')
        if (!requestType) {
          errors.marketingRequestType = 'Select a type of request'
        } else if (requestType === 'other' && !val('marketingRequestTypeOther')) {
          errors.marketingRequestTypeOther = 'Describe the type of request'
        }
        // Business cards skip the rest of the brief; everything else requires it.
        const needsBrief =
          !requestType ||
          !MARKETING_BRIEF_EXEMPT_REQUEST_TYPES.has(
            requestType as MarketingRequestType
          )
        if (needsBrief) {
          if (!val('marketingEventName')) {
            errors.marketingEventName = 'Enter a name or title (or NA)'
          }
          const audience = fd.getAll('marketingTargetAudience').map(String)
          if (audience.length === 0) {
            errors.marketingTargetAudience = 'Select at least one audience'
          } else if (
            audience.includes('other') &&
            !val('marketingTargetAudienceOther')
          ) {
            errors.marketingTargetAudienceOther = 'Describe the other audience'
          }
          if (!val('marketingKeyMessage')) {
            errors.marketingKeyMessage = 'Enter the key message or theme'
          }
          const sizeFormat = fd.getAll('marketingSizeFormat').map(String)
          if (sizeFormat.length === 0) {
            errors.marketingSizeFormat = 'Select a size or format'
          } else if (
            sizeFormat.includes('other') &&
            !val('marketingSizeFormatOther')
          ) {
            errors.marketingSizeFormatOther = 'Describe the size or format'
          }
        }
      }
    } else if (index === 2) {
      if (categoryValue !== 'it' && !val('property')) {
        errors.property = 'Select a property'
      }
    }

    return errors
  }

  function goToStep(target: number) {
    // Going back (or to the current step) is always allowed.
    if (target <= step) {
      setStepErrors({})
      setStep(target)
      return
    }
    // Going forward requires the current step to be valid.
    const form = formRef.current
    if (!form) return
    const errors = validateStep(step, new FormData(form))
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors)
      return
    }
    setStepErrors({})
    setStep(Math.min(step + 1, LAST_STEP))
  }

  // Merge client step errors with server errors for display.
  function fieldError(name: string): string | undefined {
    return stepErrors[name] ?? getError(name)
  }

  // Clear a field's client error as soon as it's edited, and defer server-error
  // hiding to the existing hook.
  function editField(name: string) {
    markEdited(name)
    setStepErrors((prev) => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const titleError = fieldError('title')
  const categoryError = fieldError('category')
  const priorityError = fieldError('priority')
  const propertyError = fieldError('property')
  const assignedToError = fieldError('assignedTo')
  const unitNumberError = fieldError('unitNumber')
  const dueAtError = fieldError('dueAt')
  const descriptionError = fieldError('description')
  const nameError = fieldError('reportedByName')
  const emailError = fieldError('reportedByEmail')
  const phoneError = fieldError('reportedByPhone')

  // Steps are kept mounted (hidden, not unmounted) so every field is still
  // submitted in the single Server Action call. Enter on a non-final step would
  // otherwise submit early, so suppress it outside of textareas / the last step.
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key === 'Enter' &&
      step < LAST_STEP &&
      (event.target as HTMLElement).tagName !== 'TEXTAREA'
    ) {
      event.preventDefault()
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-6"
    >
      <StepIndicator current={step} onSelect={goToStep} />

      <FormError state={state} />

      {/* Step 1 — Basics */}
      <StepPanel active={step === 0}>
        <FormSection
          id="basics"
          title="Basics"
          description="Name the request, and tell us its type and urgency."
        >
          <FieldGroup className="flex flex-col gap-5">
            <Field data-invalid={titleError ? 'true' : undefined}>
              <FieldLabel htmlFor="title">
                Title <Required />
              </FieldLabel>
              <Input
                id="title"
                name="title"
                autoComplete="off"
                defaultValue={state.values?.title}
                onChange={() => editField('title')}
                aria-invalid={titleError ? true : undefined}
                placeholder="A short, descriptive name for this work order"
                maxLength={120}
                required
              />
              <FieldError>{titleError}</FieldError>
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field data-invalid={categoryError ? 'true' : undefined}>
                <FieldLabel htmlFor="category">
                  Category <Required />
                </FieldLabel>
                <Select
                  name="category"
                  items={CATEGORY_LABELS}
                  value={categoryValue}
                  onValueChange={(v) => {
                    setCategoryValue(typeof v === 'string' ? v : '')
                    editField('category')
                  }}
                >
                  <SelectTrigger
                    id="category"
                    className="w-full"
                    aria-invalid={categoryError ? true : undefined}
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_ORDER_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{categoryError}</FieldError>
              </Field>

              <Field data-invalid={priorityError ? 'true' : undefined}>
                <FieldLabel htmlFor="priority">
                  Priority <Required />
                </FieldLabel>
                <Select
                  name="priority"
                  items={PRIORITY_LABELS}
                  value={priorityValue}
                  onValueChange={(v) => {
                    setPriorityValue(typeof v === 'string' ? v : '')
                    editField('priority')
                  }}
                >
                  <SelectTrigger
                    id="priority"
                    className="w-full"
                    aria-invalid={priorityError ? true : undefined}
                  >
                    <SelectValue placeholder="Select a priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_ORDER_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{priorityError}</FieldError>
              </Field>
            </div>
          </FieldGroup>
        </FormSection>
      </StepPanel>

      {/* Step 2 — Details */}
      <StepPanel active={step === 1}>
        <FormSection
          id="details"
          title="Details"
          description="What needs to happen, and by when."
        >
          <FieldGroup className="flex flex-col gap-5">
            <Field data-invalid={descriptionError ? 'true' : undefined}>
              <FieldLabel htmlFor="description">
                Description <Required />
              </FieldLabel>
              <Textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={state.values?.description}
                onChange={() => editField('description')}
                aria-invalid={descriptionError ? true : undefined}
                placeholder={
                  categoryValue === 'marketing'
                    ? MARKETING_DESCRIPTION_PLACEHOLDER
                    : DESCRIPTION_PLACEHOLDER
                }
                required
              />
              <FieldError>{descriptionError}</FieldError>
            </Field>

            <Field data-invalid={dueAtError ? 'true' : undefined}>
              <FieldLabel htmlFor="dueAt">
                Due date and time <Optional />
              </FieldLabel>
              <DateTimePicker
                id="dueAt"
                name="dueAt"
                ariaInvalid={dueAtError ? true : undefined}
                onChange={() => editField('dueAt')}
                className="sm:max-w-sm"
              />
              <FieldError>{dueAtError}</FieldError>
            </Field>
          </FieldGroup>
        </FormSection>

        {RECURRING_CATEGORIES.has(categoryValue as WorkOrderCategory) ? (
          <FormSection
            id="recurrence"
            title="Repeat"
            description="Make this a recurring inspection or license. The due date above is the first occurrence; later ones are filed automatically."
          >
            <FieldGroup className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="frequency">
                    Frequency <Optional />
                  </FieldLabel>
                  <Select
                    name="frequency"
                    items={FREQUENCY_LABELS}
                    value={frequencyValue}
                    onValueChange={(v) => {
                      setFrequencyValue(typeof v === 'string' ? v : '')
                      editField('frequency')
                      // Selecting a cadence makes the due date required, so clear
                      // any stale due-date error as the requirement changes.
                      editField('dueAt')
                    }}
                  >
                    <SelectTrigger id="frequency" className="w-full">
                      <SelectValue placeholder="Does not repeat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Does not repeat</SelectItem>
                      {RECURRENCE_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FREQUENCY_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="provider">
                    Provider <Optional />
                  </FieldLabel>
                  <Input
                    id="provider"
                    name="provider"
                    autoComplete="off"
                    placeholder="e.g. Cartersville Sprinkler"
                    defaultValue={state.values?.provider}
                    onChange={() => editField('provider')}
                  />
                </Field>
              </div>

              <RecurrenceReminders
                assignableUsers={assignableUsers}
                defaultLeadDays={reminderLeadDefaults}
                defaultRecipients={reminderRecipientDefaults}
              />
            </FieldGroup>
          </FormSection>
        ) : null}

        {categoryValue === 'marketing' ? (
          <FormSection
            id="marketing"
            title="Marketing brief"
            description="Details the design team needs for this marketing request."
          >
            <MarketingFields
              state={state}
              defaults={emptyMarketingDefaults}
              markEdited={editField}
              getError={fieldError}
            />
          </FormSection>
        ) : null}
      </StepPanel>

      {/* Step 3 — Location & assignment */}
      <StepPanel active={step === 2}>
        <FormSection
          id="location"
          title="Location & assignment"
          description="Where is the work needed, and who owns it?"
        >
          <FieldGroup className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field data-invalid={propertyError ? 'true' : undefined}>
                <FieldLabel htmlFor="property">
                  Property {categoryValue === 'it' ? <Optional /> : <Required />}
                </FieldLabel>
                <Select
                  name="property"
                  items={PROPERTY_LABELS}
                  value={propertyValue}
                  onValueChange={(v) => {
                    setPropertyValue(typeof v === 'string' ? v : '')
                    editField('property')
                  }}
                >
                  <SelectTrigger
                    id="property"
                    className="w-full"
                    aria-invalid={propertyError ? true : undefined}
                  >
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROPERTY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{propertyError}</FieldError>
              </Field>

              <Field data-invalid={unitNumberError ? 'true' : undefined}>
                <FieldLabel htmlFor="unitNumber">
                  Unit number <Optional />
                </FieldLabel>
                <Input
                  id="unitNumber"
                  name="unitNumber"
                  autoComplete="off"
                  defaultValue={state.values?.unitNumber}
                  onChange={() => editField('unitNumber')}
                  aria-invalid={unitNumberError ? true : undefined}
                  placeholder="e.g. 2A"
                />
                <FieldError>{unitNumberError}</FieldError>
              </Field>
            </div>

            <Field data-invalid={assignedToError ? 'true' : undefined}>
              <FieldLabel htmlFor="assignedTo">
                Assignee <Optional />
              </FieldLabel>
              <Select
                name="assignedTo"
                items={assigneeItems}
                value={assignedToValue}
                onValueChange={(v) => {
                  setAssignedToValue(typeof v === 'string' ? v : '')
                  editField('assignedTo')
                }}
              >
                <SelectTrigger
                  id="assignedTo"
                  className="w-full sm:max-w-sm"
                  aria-invalid={assignedToError ? true : undefined}
                >
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {formatAssigneeLabel(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{assignedToError}</FieldError>
            </Field>
          </FieldGroup>
        </FormSection>
      </StepPanel>

      {/* Step 4 — Reporter & notes */}
      <StepPanel active={step === 3}>
        <FormSection
          id="reporter"
          title="Reporter"
          description="Pre-filled with your details. Update them if you're filing this on behalf of someone else."
        >
          <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field data-invalid={nameError ? 'true' : undefined}>
              <FieldLabel htmlFor="reportedByName">
                Name <Optional />
              </FieldLabel>
              <Input
                id="reportedByName"
                name="reportedByName"
                autoComplete="name"
                placeholder="e.g. Alex Doe"
                defaultValue={
                  state.values?.reportedByName ?? reporterDefaults?.name
                }
                onChange={() => editField('reportedByName')}
                aria-invalid={nameError ? true : undefined}
              />
              <FieldError>{nameError}</FieldError>
            </Field>

            <Field data-invalid={emailError ? 'true' : undefined}>
              <FieldLabel htmlFor="reportedByEmail">
                Email <Optional />
              </FieldLabel>
              <Input
                id="reportedByEmail"
                name="reportedByEmail"
                type="email"
                autoComplete="email"
                placeholder="username@highlands.care"
                defaultValue={
                  state.values?.reportedByEmail ?? reporterDefaults?.email
                }
                onChange={() => editField('reportedByEmail')}
                aria-invalid={emailError ? true : undefined}
              />
              <FieldError>{emailError}</FieldError>
            </Field>

            <Field data-invalid={phoneError ? 'true' : undefined}>
              <FieldLabel htmlFor="reportedByPhone">
                Phone <Optional />
              </FieldLabel>
              <Input
                id="reportedByPhone"
                name="reportedByPhone"
                type="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                defaultValue={
                  state.values?.reportedByPhone ?? reporterDefaults?.phone
                }
                onChange={() => editField('reportedByPhone')}
                aria-invalid={phoneError ? true : undefined}
              />
              <FieldError>{phoneError}</FieldError>
            </Field>
          </FieldGroup>
        </FormSection>

        <FormSection
          id="notes"
          title="Notes"
          description="Optional notes for the team. Add context or instructions that should appear with the work order."
        >
          <div className="flex flex-col gap-3">
            {notes.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {notes.map((body, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Textarea
                      name="note"
                      rows={3}
                      value={body}
                      onChange={(e) => {
                        const next = [...notes]
                        next[index] = e.target.value
                        setNotes(next)
                      }}
                      placeholder="Write a note visible to everyone on this work order…"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      aria-label="Remove note"
                      onClick={() =>
                        setNotes(notes.filter((_, i) => i !== index))
                      }
                      className="mt-1.5 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        &times;
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={() => setNotes([...notes, ''])}
              className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              + Add a note
            </button>
          </div>
        </FormSection>
      </StepPanel>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => goToStep(step - 1)}
          className={step === 0 ? 'invisible' : undefined}
        >
          Back
        </Button>
        {step < LAST_STEP ? (
          <Button type="button" size="lg" onClick={() => goToStep(step + 1)}>
            Continue
          </Button>
        ) : (
          <SubmitButton label="Create work order" pendingLabel="Creating..." />
        )}
      </div>
    </form>
  )
}

function StepIndicator({
  current,
  onSelect,
}: {
  current: number
  onSelect: (step: number) => void
}) {
  return (
    <nav
      aria-label="Progress"
      className="flex flex-wrap items-center gap-x-2 gap-y-2"
    >
      {STEPS.map((s, i) => {
        const isCurrent = i === current
        const isComplete = i < current
        // Forward steps are locked until the current step passes validation.
        const isLocked = i > current
        return (
          <button
            key={s.title}
            type="button"
            onClick={() => onSelect(i)}
            disabled={isLocked}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-sm transition-colors',
              isCurrent
                ? 'bg-primary/10 text-foreground'
                : isLocked
                  ? 'text-muted-foreground/50'
                  : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isComplete
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {isComplete ? (
                <RiCheckLine className="size-3.5" aria-hidden="true" />
              ) : (
                i + 1
              )}
            </span>
            <span className="font-medium">{s.title}</span>
          </button>
        )
      })}
    </nav>
  )
}

function StepPanel({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  // Hidden (not unmounted) so all fields stay in the form and submit together.
  return <div className={active ? 'flex flex-col gap-6' : 'hidden'}>{children}</div>
}

function FormSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  const titleId = `${id}-title`
  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none"
    >
      <header className="border-b bg-muted/30 px-6 py-4">
        <h2
          id={titleId}
          className="font-heading text-base font-semibold tracking-tight"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  )
}

function Required() {
  return (
    <span className="text-xs font-normal text-destructive" aria-hidden="true">
      *
    </span>
  )
}

function Optional() {
  return (
    <span
      className="text-xs font-normal text-muted-foreground"
      aria-hidden="true"
    >
      (optional)
    </span>
  )
}
