'use client'

import { useActionState, useState, type ReactNode } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
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
  MARKETING_DESCRIPTION_PLACEHOLDER,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  PROPERTIES,
} from '@/lib/schemas/work-order'

import {
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

import { initialAuthState } from '../../(auth)/auth-state'
import { createWorkOrderAction } from '../actions'
import { MarketingFields, emptyMarketingDefaults } from '../marketing-fields'

const DESCRIPTION_PLACEHOLDER =
  'What needs to be done? Include anything a technician should know.'

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
  if (storedState !== state) {
    setStoredState(state)
    setCategoryValue(state.values?.category ?? '')
    setPriorityValue(state.values?.priority ?? '')
    setPropertyValue(state.values?.property ?? '')
    setAssignedToValue(state.values?.assignedTo ?? '')
  }

  const titleError = getError('title')
  const categoryError = getError('category')
  const priorityError = getError('priority')
  const propertyError = getError('property')
  const assignedToError = getError('assignedTo')
  const unitNumberError = getError('unitNumber')
  const dueAtError = getError('dueAt')
  const descriptionError = getError('description')
  const nameError = getError('reportedByName')
  const emailError = getError('reportedByEmail')
  const phoneError = getError('reportedByPhone')

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <FormError state={state} />

      <FormSection
        id="issue"
        title="Issue"
        description="What kind of problem is this, and how urgent?"
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                markEdited('priority')
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
        </FieldGroup>
      </FormSection>

      <FormSection
        id="assignment"
        title="Assignment"
        description="Pick the person responsible for this work order."
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={assignedToError ? 'true' : undefined}>
            <FieldLabel htmlFor="assignedTo">
              Assignee <Required />
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
              <SelectTrigger
                id="assignedTo"
                className="w-full"
                aria-invalid={assignedToError ? true : undefined}
              >
                <SelectValue placeholder="Select an assignee" />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No users available to assign.
                  </div>
                ) : (
                  assignableUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {formatAssigneeLabel(u)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <FieldError>{assignedToError}</FieldError>
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection
        id="location"
        title="Location"
        description="Where is the work needed?"
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              onChange={() => markEdited('unitNumber')}
              aria-invalid={unitNumberError ? true : undefined}
              placeholder="e.g. 2A"
            />
            <FieldError>{unitNumberError}</FieldError>
          </Field>
        </FieldGroup>
      </FormSection>

      {categoryValue === 'marketing' ? (
        <FormSection
          id="marketing"
          title="Marketing"
          description="Details the design team needs for this marketing request."
        >
          <MarketingFields
            state={state}
            defaults={emptyMarketingDefaults}
            markEdited={markEdited}
            getError={getError}
          />
        </FormSection>
      ) : null}

      <FormSection
        id="details"
        title="Details"
        description="What needs to happen, and by when."
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
              onChange={() => markEdited('title')}
              aria-invalid={titleError ? true : undefined}
              placeholder="A short, descriptive name for this work order"
              maxLength={120}
              required
            />
            <FieldError>{titleError}</FieldError>
          </Field>

          <Field data-invalid={descriptionError ? 'true' : undefined}>
            <FieldLabel htmlFor="description">
              Description <Required />
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={state.values?.description}
              onChange={() => markEdited('description')}
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
              onChange={() => markEdited('dueAt')}
              className="sm:max-w-sm"
            />
            <FieldError>{dueAtError}</FieldError>
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection
        id="reporter"
        title="Reporter"
        description="Who is this being reported on behalf of? Leave blank if you are the reporter."
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
              onChange={() => markEdited('reportedByName')}
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
              placeholder="alex@example.com"
              defaultValue={
                state.values?.reportedByEmail ?? reporterDefaults?.email
              }
              onChange={() => markEdited('reportedByEmail')}
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
              onChange={() => markEdited('reportedByPhone')}
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

      <div className="flex items-center justify-end gap-3 pt-2">
        <SubmitButton label="Create work order" pendingLabel="Creating..." />
      </div>
    </form>
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
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
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

