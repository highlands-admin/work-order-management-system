'use client'

import { useActionState, useState, type ReactNode } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
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
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  PROPERTIES,
  RECURRENCE_FREQUENCIES,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  WORK_ORDER_PRIORITIES,
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import {
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

import { initialAuthState } from '../../../../(auth)/auth-state'
import {
  deleteRecurringWorkOrderAction,
  updateRecurringWorkOrderAction,
} from '../../../actions'
import { RecurrenceReminders } from '../../../new/recurrence-reminders'

const ACTIVE_LABELS: Record<string, string> = {
  true: 'Active',
  false: 'Paused',
}

export type RecurringSchedule = {
  id: string
  title: string
  category: WorkOrderCategory
  priority: WorkOrderPriority
  property: Property | null
  unit_number: string | null
  description: string
  provider: string | null
  assigned_to: string | null
  frequency: RecurrenceFrequency
  next_due_at: string | null
  reminder_lead_days: number[]
  reminder_recipients: string[]
  active: boolean
}

export function EditRecurringForm({
  schedule,
  assignableUsers,
}: {
  schedule: RecurringSchedule
  assignableUsers: AssignableUser[]
}) {
  const updateAction = updateRecurringWorkOrderAction.bind(null, schedule.id)
  const [state, action] = useActionState(updateAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)

  const [categoryValue, setCategoryValue] = useState(
    state.values?.category ?? schedule.category
  )
  const [priorityValue, setPriorityValue] = useState(
    state.values?.priority ?? schedule.priority
  )
  const [propertyValue, setPropertyValue] = useState(
    state.values?.property ?? schedule.property ?? ''
  )
  const [frequencyValue, setFrequencyValue] = useState(
    state.values?.frequency ?? schedule.frequency
  )
  const [assignedToValue, setAssignedToValue] = useState(
    state.values?.assignedTo ?? schedule.assigned_to ?? ''
  )
  const [activeValue, setActiveValue] = useState(
    state.values?.active ?? (schedule.active ? 'true' : 'false')
  )

  const [storedState, setStoredState] = useState(state)
  if (storedState !== state) {
    setStoredState(state)
    setCategoryValue(state.values?.category ?? schedule.category)
    setPriorityValue(state.values?.priority ?? schedule.priority)
    setPropertyValue(state.values?.property ?? schedule.property ?? '')
    setFrequencyValue(state.values?.frequency ?? schedule.frequency)
    setAssignedToValue(state.values?.assignedTo ?? schedule.assigned_to ?? '')
    setActiveValue(state.values?.active ?? (schedule.active ? 'true' : 'false'))
  }

  const titleError = getError('title')
  const categoryError = getError('category')
  const priorityError = getError('priority')
  const propertyError = getError('property')
  const unitNumberError = getError('unitNumber')
  const descriptionError = getError('description')
  const frequencyError = getError('frequency')
  const dueAtError = getError('dueAt')

  const assigneeItems = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <FormError state={state} />

      <FormSection id="basics" title="Schedule" description="What recurs, and how urgent it is.">
        <FieldGroup className="flex flex-col gap-5">
          <Field data-invalid={titleError ? 'true' : undefined}>
            <FieldLabel htmlFor="title">
              Title <Required />
            </FieldLabel>
            <Input
              id="title"
              name="title"
              autoComplete="off"
              defaultValue={state.values?.title ?? schedule.title}
              onChange={() => markEdited('title')}
              aria-invalid={titleError ? true : undefined}
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
                  markEdited('category')
                }}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_CATEGORIES_BY_LABEL.map((c) => (
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
                  markEdited('priority')
                }}
              >
                <SelectTrigger id="priority" className="w-full">
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

          <Field data-invalid={descriptionError ? 'true' : undefined}>
            <FieldLabel htmlFor="description">
              Description <Required />
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={state.values?.description ?? schedule.description}
              onChange={() => markEdited('description')}
              aria-invalid={descriptionError ? true : undefined}
              required
            />
            <FieldError>{descriptionError}</FieldError>
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
              defaultValue={state.values?.provider ?? schedule.provider ?? ''}
              onChange={() => markEdited('provider')}
            />
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection
        id="cadence"
        title="Cadence"
        description="How often this repeats and when the next occurrence is due."
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={frequencyError ? 'true' : undefined}>
            <FieldLabel htmlFor="frequency">
              Frequency <Required />
            </FieldLabel>
            <Select
              name="frequency"
              items={FREQUENCY_LABELS}
              value={frequencyValue}
              onValueChange={(v) => {
                setFrequencyValue(typeof v === 'string' ? v : '')
                markEdited('frequency')
              }}
            >
              <SelectTrigger id="frequency" className="w-full">
                <SelectValue placeholder="Select a frequency" />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{frequencyError}</FieldError>
          </Field>

          <Field data-invalid={dueAtError ? 'true' : undefined}>
            <FieldLabel htmlFor="dueAt">
              Next due date <Required />
            </FieldLabel>
            <DateTimePicker
              id="dueAt"
              name="dueAt"
              value={state.values?.dueAt ?? schedule.next_due_at ?? undefined}
              ariaInvalid={dueAtError ? true : undefined}
              onChange={() => markEdited('dueAt')}
            />
            <FieldError>{dueAtError}</FieldError>
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection
        id="reminders"
        title="Reminders"
        description="Email alerts before each occurrence, and who receives them."
      >
        <RecurrenceReminders
          assignableUsers={assignableUsers}
          defaultLeadDays={schedule.reminder_lead_days}
          defaultRecipients={schedule.reminder_recipients}
        />
      </FormSection>

      <FormSection
        id="location"
        title="Location & assignment"
        description="Where the work happens, who owns it, and whether the schedule is running."
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
                  markEdited('property')
                }}
              >
                <SelectTrigger id="property" className="w-full">
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
                defaultValue={state.values?.unitNumber ?? schedule.unit_number ?? ''}
                onChange={() => markEdited('unitNumber')}
                placeholder="e.g. 2A"
              />
              <FieldError>{unitNumberError}</FieldError>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="assignedTo">
                Default assignee <Optional />
              </FieldLabel>
              <Select
                name="assignedTo"
                items={assigneeItems}
                value={assignedToValue}
                onValueChange={(v) => {
                  setAssignedToValue(typeof v === 'string' ? v : '')
                  markEdited('assignedTo')
                }}
              >
                <SelectTrigger id="assignedTo" className="w-full">
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
            </Field>

            <Field>
              <FieldLabel htmlFor="active">State</FieldLabel>
              <Select
                name="active"
                items={ACTIVE_LABELS}
                value={activeValue}
                onValueChange={(v) => {
                  setActiveValue(typeof v === 'string' ? v : 'true')
                  markEdited('active')
                }}
              >
                <SelectTrigger id="active" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Paused</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>
      </FormSection>

      <div className="flex items-center justify-between gap-3 pt-2">
        <DeleteScheduleButton scheduleId={schedule.id} title={schedule.title} />
        <SubmitButton label="Save changes" pendingLabel="Saving..." />
      </div>
    </form>
  )
}

function DeleteScheduleButton({
  scheduleId,
  title,
}: {
  scheduleId: string
  title: string
}) {
  const deleteAction = deleteRecurringWorkOrderAction.bind(null, scheduleId)
  const [, runDelete] = useActionState(deleteAction, initialAuthState)

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" size="lg">
            Delete schedule
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
        <AlertDialogDescription>
          “{title}” will stop generating work orders. Occurrences already created
          are kept. This cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <form action={runDelete}>
            <SubmitButton
              label="Delete"
              pendingLabel="Deleting..."
              size="sm"
              className="w-full bg-destructive text-white hover:bg-destructive/90 sm:w-auto"
            />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
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
    <span className="text-xs font-normal text-muted-foreground" aria-hidden="true">
      (optional)
    </span>
  )
}
