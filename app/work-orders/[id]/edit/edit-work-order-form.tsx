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
import { PhoneInput } from '@/components/ui/phone-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  AttachmentUploader,
  type ExistingAttachment,
} from '@/components/work-orders/attachment-uploader'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import {
  CATEGORY_LABELS,
  IT_REQUEST_TYPES,
  IT_REQUEST_TYPE_LABELS,
  MARKETING_DESCRIPTION_PLACEHOLDER,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  WORK_ORDER_PRIORITIES,
  PROPERTIES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

import {
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

import { initialAuthState } from '../../../(auth)/auth-state'
import { updateWorkOrderAction } from '../../actions'
import { MarketingFields, type MarketingDefaults } from '../../marketing-fields'
import { NotifyRecipientsField } from '../../notify-recipients-field'

type WorkOrder = {
  id: string
  title: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  resolution: string | null
  assigned_to: string | null
  notify_recipients: string[] | null
  validated_by: string | null
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
  provider: string | null
  it_request_type: string | null
  marketing_request_type: string | null
  marketing_request_type_other: string | null
  marketing_event_name: string | null
  marketing_target_audience: string[] | null
  marketing_target_audience_other: string | null
  marketing_key_message: string | null
  marketing_size_format: string[] | null
  marketing_size_format_other: string | null
}

export function EditWorkOrderForm({
  workOrder,
  allowedStatuses,
  assignableUsers,
  attachments,
}: {
  workOrder: WorkOrder
  allowedStatuses: WorkOrderStatus[]
  assignableUsers: AssignableUser[]
  attachments: ExistingAttachment[]
}) {
  // Value -> label maps let each Select show the chosen option's label (not the
  // raw stored value) without the dropdown items being mounted.
  const assigneeItems = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const statusLocked = allowedStatuses.length <= 1
  const boundAction = updateWorkOrderAction.bind(null, workOrder.id)
  const [state, action] = useActionState(boundAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)

  const [storedState, setStoredState] = useState(state)
  // True while an attachment is still uploading, so Save is blocked until it
  // finishes and its metadata field is present in the form.
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [categoryValue, setCategoryValue] = useState<string>(
    state.values?.category ?? workOrder.category
  )
  const [priorityValue, setPriorityValue] = useState<string>(
    state.values?.priority ?? workOrder.priority
  )
  const [propertyValue, setPropertyValue] = useState<string>(
    state.values?.property ?? workOrder.property ?? ''
  )
  const [statusValue, setStatusValue] = useState<string>(
    state.values?.status ?? workOrder.status
  )
  const [assignedToValue, setAssignedToValue] = useState<string>(
    state.values?.assignedTo ?? workOrder.assigned_to ?? ''
  )
  const [validatedByValue, setValidatedByValue] = useState<string>(
    state.values?.validatedBy ?? workOrder.validated_by ?? ''
  )
  const [itRequestTypeValue, setItRequestTypeValue] = useState<string>(
    state.values?.itRequestType ?? workOrder.it_request_type ?? ''
  )
  if (storedState !== state) {
    setStoredState(state)
    setCategoryValue(state.values?.category ?? workOrder.category)
    setPriorityValue(state.values?.priority ?? workOrder.priority)
    setPropertyValue(state.values?.property ?? workOrder.property ?? '')
    setStatusValue(state.values?.status ?? workOrder.status)
    setAssignedToValue(state.values?.assignedTo ?? workOrder.assigned_to ?? '')
    setValidatedByValue(state.values?.validatedBy ?? workOrder.validated_by ?? '')
    setItRequestTypeValue(
      state.values?.itRequestType ?? workOrder.it_request_type ?? ''
    )
  }

  const titleError = getError('title')
  const categoryError = getError('category')
  const priorityError = getError('priority')
  const propertyError = getError('property')
  const statusError = getError('status')
  const assignedToError = getError('assignedTo')
  const validatedByError = getError('validatedBy')
  const unitNumberError = getError('unitNumber')
  const dueAtError = getError('dueAt')
  const descriptionError = getError('description')
  const itRequestTypeError = getError('itRequestType')
  const resolutionError = getError('resolution')
  const nameError = getError('reportedByName')
  const emailError = getError('reportedByEmail')
  const phoneError = getError('reportedByPhone')
  const providerError = getError('provider')

  const marketingDefaults: MarketingDefaults = {
    requestType: workOrder.marketing_request_type ?? '',
    requestTypeOther: workOrder.marketing_request_type_other ?? '',
    eventName: workOrder.marketing_event_name ?? '',
    targetAudience: workOrder.marketing_target_audience ?? [],
    targetAudienceOther: workOrder.marketing_target_audience_other ?? '',
    keyMessage: workOrder.marketing_key_message ?? '',
    sizeFormat: workOrder.marketing_size_format ?? [],
    sizeFormatOther: workOrder.marketing_size_format_other ?? '',
  }

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
        description="Who is responsible for this work order."
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                markEdited('assignedTo')
              }}
            >
              <SelectTrigger
                id="assignedTo"
                className="w-full"
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

      <FormSection
        id="notifications"
        title="Notifications"
        description="Recipients get notified of every update to this work order, just like the assignee."
      >
        <NotifyRecipientsField
          users={assignableUsers}
          defaultValue={workOrder.notify_recipients ?? []}
        />
      </FormSection>

      <FormSection
        id="status"
        title="Status"
        description={
          statusLocked
            ? workOrder.status === 'pending'
              ? 'Awaiting administrator approval. Status will change once an admin reviews this submission.'
              : workOrder.status === 'rejected'
                ? 'This submission was rejected. Only an administrator can reopen it.'
                : 'Status is locked for your role on this work order.'
            : 'Where this ticket is in the workflow.'
        }
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={statusError ? 'true' : undefined}>
            <FieldLabel htmlFor="status">
              Status {statusLocked ? null : <Required />}
            </FieldLabel>
            {statusLocked ? (
              <>
                <div
                  id="status"
                  className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                >
                  {STATUS_LABELS[workOrder.status]}
                </div>
                <input type="hidden" name="status" value={workOrder.status} />
              </>
            ) : (
              <Select
                name="status"
                items={STATUS_LABELS}
                value={statusValue}
                onValueChange={(v) => {
                  setStatusValue(typeof v === 'string' ? v : '')
                  markEdited('status')
                }}
              >
                <SelectTrigger
                  id="status"
                  className="w-full"
                  aria-invalid={statusError ? true : undefined}
                >
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {allowedStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError>{statusError}</FieldError>
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
              Facility {categoryValue === 'it' ? <Optional /> : <Required />}
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
                <SelectValue placeholder="Select a facility" />
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
              defaultValue={state.values?.unitNumber ?? workOrder.unit_number ?? ''}
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
            defaults={marketingDefaults}
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
              defaultValue={state.values?.title ?? workOrder.title}
              onChange={() => markEdited('title')}
              aria-invalid={titleError ? true : undefined}
              placeholder="A short, descriptive name for this work order"
              maxLength={120}
              required
            />
            <FieldError>{titleError}</FieldError>
          </Field>

          {categoryValue === 'it' ? (
            <Field data-invalid={itRequestTypeError ? 'true' : undefined}>
              <FieldLabel htmlFor="itRequestType">
                Type of request <Optional />
              </FieldLabel>
              <Select
                name="itRequestType"
                items={IT_REQUEST_TYPE_LABELS}
                value={itRequestTypeValue}
                onValueChange={(v) => {
                  setItRequestTypeValue(typeof v === 'string' ? v : '')
                  markEdited('itRequestType')
                }}
              >
                <SelectTrigger
                  id="itRequestType"
                  className="w-full sm:max-w-sm"
                  aria-invalid={itRequestTypeError ? true : undefined}
                >
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  {IT_REQUEST_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {IT_REQUEST_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{itRequestTypeError}</FieldError>
            </Field>
          ) : null}

          <Field data-invalid={descriptionError ? 'true' : undefined}>
            <FieldLabel htmlFor="description">
              Description <Required />
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={state.values?.description ?? workOrder.description}
              onChange={() => markEdited('description')}
              aria-invalid={descriptionError ? true : undefined}
              placeholder={
                categoryValue === 'marketing'
                  ? MARKETING_DESCRIPTION_PLACEHOLDER
                  : undefined
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
              value={state.values?.dueAt ?? workOrder.due_at ?? undefined}
              ariaInvalid={dueAtError ? true : undefined}
              onChange={() => markEdited('dueAt')}
              className="sm:max-w-sm"
              disablePast
            />
            <FieldError>{dueAtError}</FieldError>
          </Field>

          <Field data-invalid={providerError ? 'true' : undefined}>
            <FieldLabel htmlFor="provider">
              Provider <Optional />
            </FieldLabel>
            <Input
              id="provider"
              name="provider"
              autoComplete="off"
              placeholder="e.g. Cartersville Sprinkler"
              defaultValue={state.values?.provider ?? workOrder.provider ?? ''}
              onChange={() => markEdited('provider')}
              aria-invalid={providerError ? true : undefined}
            />
            <FieldError>{providerError}</FieldError>
          </Field>

          <Field data-invalid={resolutionError ? 'true' : undefined}>
            <FieldLabel htmlFor="resolution">
              Resolution{' '}
              {statusValue === 'done' || statusValue === 'closed' ? (
                <Required />
              ) : (
                <Optional />
              )}
            </FieldLabel>
            <Textarea
              id="resolution"
              name="resolution"
              rows={4}
              defaultValue={state.values?.resolution ?? workOrder.resolution ?? ''}
              onChange={() => markEdited('resolution')}
              aria-invalid={resolutionError ? true : undefined}
              placeholder={
                statusValue === 'done' || statusValue === 'closed'
                  ? 'Required: describe how this work order was resolved.'
                  : 'What was done to resolve this ticket?'
              }
            />
            <FieldError>{resolutionError}</FieldError>
          </Field>

          <Field data-invalid={validatedByError ? 'true' : undefined}>
            <FieldLabel htmlFor="validatedBy">
              Validated by{' '}
              {statusValue === 'closed' ? <Required /> : <Optional />}
            </FieldLabel>
            <Select
              name="validatedBy"
              items={assigneeItems}
              value={validatedByValue}
              onValueChange={(v) => {
                setValidatedByValue(typeof v === 'string' ? v : '')
                markEdited('validatedBy')
              }}
            >
              <SelectTrigger
                id="validatedBy"
                className="w-full sm:max-w-sm"
                aria-invalid={validatedByError ? true : undefined}
              >
                <SelectValue placeholder="Not validated" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Not validated</SelectItem>
                {assignableUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {formatAssigneeLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{validatedByError}</FieldError>
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection
        id="attachments"
        title="Attachments"
        description="Photos or documents for this work order. Add new ones or remove existing files."
      >
        <AttachmentUploader
          existing={attachments}
          compressImages={categoryValue !== 'marketing'}
          category={categoryValue}
          onUploadingChange={setAttachmentsUploading}
        />
      </FormSection>

      <FormSection
        id="reporter"
        title="Reporter"
        description="Who reported this issue."
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
                state.values?.reportedByName ?? workOrder.reported_by_name ?? ''
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
              placeholder="username@highlands.care"
              defaultValue={
                state.values?.reportedByEmail ??
                workOrder.reported_by_email ??
                ''
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
            <PhoneInput
              id="reportedByPhone"
              name="reportedByPhone"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              defaultValue={
                state.values?.reportedByPhone ??
                workOrder.reported_by_phone ??
                ''
              }
              onValueChange={() => markEdited('reportedByPhone')}
              aria-invalid={phoneError ? true : undefined}
            />
            <FieldError>{phoneError}</FieldError>
          </Field>
        </FieldGroup>
      </FormSection>

      <div className="flex items-center justify-end gap-3 pt-2">
        <SubmitButton
          label={attachmentsUploading ? 'Uploading…' : 'Save changes'}
          pendingLabel="Saving..."
          disabled={attachmentsUploading}
        />
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
