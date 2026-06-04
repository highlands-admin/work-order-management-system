'use client'

import { useState } from 'react'

import {
  Field,
  FieldDescription,
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
import {
  MARKETING_REQUEST_TYPES,
  MARKETING_REQUEST_TYPE_LABELS,
  MARKETING_SIZE_FORMATS,
  MARKETING_SIZE_FORMAT_LABELS,
  MARKETING_TARGET_AUDIENCES,
  MARKETING_TARGET_AUDIENCE_LABELS,
} from '@/lib/schemas/work-order'

import type { AuthState } from '../(auth)/auth-state'

export type MarketingDefaults = {
  requestType: string
  requestTypeOther: string
  eventName: string
  targetAudience: string[]
  targetAudienceOther: string
  keyMessage: string
  sizeFormat: string[]
  sizeFormatOther: string
}

export const emptyMarketingDefaults: MarketingDefaults = {
  requestType: '',
  requestTypeOther: '',
  eventName: '',
  targetAudience: [],
  targetAudienceOther: '',
  keyMessage: '',
  sizeFormat: [],
  sizeFormatOther: '',
}

// AuthState echoes multi-selects back as a comma-joined string. Split the named
// field, dropping empties, so the checkbox group rehydrates after a failed
// submit.
function multiFromState(
  state: AuthState,
  key: 'marketingTargetAudience' | 'marketingSizeFormat',
  fallback: string[]
): string[] {
  const value = state.values?.[key]
  if (value === undefined) return fallback
  return value.split(',').filter((v) => v.length > 0)
}

export function MarketingFields({
  state,
  defaults,
  markEdited,
  getError,
}: {
  state: AuthState
  defaults: MarketingDefaults
  markEdited: (name: string) => void
  getError: (name: string) => string | undefined
}) {
  // Selects and checkboxes must be controlled so the 'other' free-text fields
  // can toggle and so the values survive a failed submission. Reset to the
  // latest server values whenever a new action state arrives, matching the
  // pattern used by the parent forms.
  const [storedState, setStoredState] = useState(state)
  const [requestType, setRequestType] = useState<string>(
    state.values?.marketingRequestType ?? defaults.requestType
  )
  const [audience, setAudience] = useState<string[]>(
    multiFromState(state, 'marketingTargetAudience', defaults.targetAudience)
  )
  const [sizeFormats, setSizeFormats] = useState<string[]>(
    multiFromState(state, 'marketingSizeFormat', defaults.sizeFormat)
  )
  if (storedState !== state) {
    setStoredState(state)
    setRequestType(state.values?.marketingRequestType ?? defaults.requestType)
    setAudience(
      multiFromState(state, 'marketingTargetAudience', defaults.targetAudience)
    )
    setSizeFormats(
      multiFromState(state, 'marketingSizeFormat', defaults.sizeFormat)
    )
  }

  const requestTypeError = getError('marketingRequestType')
  const requestTypeOtherError = getError('marketingRequestTypeOther')
  const eventNameError = getError('marketingEventName')
  const audienceError = getError('marketingTargetAudience')
  const audienceOtherError = getError('marketingTargetAudienceOther')
  const keyMessageError = getError('marketingKeyMessage')
  const sizeFormatError = getError('marketingSizeFormat')
  const sizeFormatOtherError = getError('marketingSizeFormatOther')

  function toggleAudience(value: string, checked: boolean) {
    setAudience((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    )
    markEdited('marketingTargetAudience')
  }

  function toggleSizeFormat(value: string, checked: boolean) {
    setSizeFormats((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    )
    markEdited('marketingSizeFormat')
  }

  return (
    <FieldGroup className="flex flex-col gap-5">
      <Field data-invalid={requestTypeError ? 'true' : undefined}>
        <FieldLabel htmlFor="marketingRequestType">
          Type of request <Required />
        </FieldLabel>
        <Select
          name="marketingRequestType"
          items={MARKETING_REQUEST_TYPE_LABELS}
          value={requestType}
          onValueChange={(v) => {
            setRequestType(typeof v === 'string' ? v : '')
            markEdited('marketingRequestType')
          }}
        >
          <SelectTrigger
            id="marketingRequestType"
            className="w-full sm:max-w-sm"
            aria-invalid={requestTypeError ? true : undefined}
          >
            <SelectValue placeholder="Select a type of request" />
          </SelectTrigger>
          <SelectContent>
            {MARKETING_REQUEST_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {MARKETING_REQUEST_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{requestTypeError}</FieldError>
      </Field>

      {requestType === 'other' ? (
        <Field data-invalid={requestTypeOtherError ? 'true' : undefined}>
          <FieldLabel htmlFor="marketingRequestTypeOther">
            Other type of request <Required />
          </FieldLabel>
          <Input
            id="marketingRequestTypeOther"
            name="marketingRequestTypeOther"
            autoComplete="off"
            defaultValue={
              state.values?.marketingRequestTypeOther ??
              defaults.requestTypeOther
            }
            onChange={() => markEdited('marketingRequestTypeOther')}
            aria-invalid={requestTypeOtherError ? true : undefined}
            placeholder="Describe the type of request"
          />
          <FieldError>{requestTypeOtherError}</FieldError>
        </Field>
      ) : null}

      <Field data-invalid={eventNameError ? 'true' : undefined}>
        <FieldLabel htmlFor="marketingEventName">
          Name or title of event <Required />
        </FieldLabel>
        <Input
          id="marketingEventName"
          name="marketingEventName"
          autoComplete="off"
          defaultValue={state.values?.marketingEventName ?? defaults.eventName}
          onChange={() => markEdited('marketingEventName')}
          aria-invalid={eventNameError ? true : undefined}
          placeholder="If this is not for an event, you may enter NA."
        />
        <FieldError>{eventNameError}</FieldError>
      </Field>

      <Field data-invalid={audienceError ? 'true' : undefined}>
        <FieldLabel>
          Target audience <Required />
        </FieldLabel>
        <FieldDescription>Select all that apply.</FieldDescription>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MARKETING_TARGET_AUDIENCES.map((a) => (
            <label
              key={a}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                name="marketingTargetAudience"
                value={a}
                checked={audience.includes(a)}
                onChange={(e) => toggleAudience(a, e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              />
              {MARKETING_TARGET_AUDIENCE_LABELS[a]}
            </label>
          ))}
        </div>
        <FieldError>{audienceError}</FieldError>
      </Field>

      {audience.includes('other') ? (
        <Field data-invalid={audienceOtherError ? 'true' : undefined}>
          <FieldLabel htmlFor="marketingTargetAudienceOther">
            Other audience <Required />
          </FieldLabel>
          <Input
            id="marketingTargetAudienceOther"
            name="marketingTargetAudienceOther"
            autoComplete="off"
            defaultValue={
              state.values?.marketingTargetAudienceOther ??
              defaults.targetAudienceOther
            }
            onChange={() => markEdited('marketingTargetAudienceOther')}
            aria-invalid={audienceOtherError ? true : undefined}
            placeholder="Describe the other audience"
          />
          <FieldError>{audienceOtherError}</FieldError>
        </Field>
      ) : null}

      <Field data-invalid={keyMessageError ? 'true' : undefined}>
        <FieldLabel htmlFor="marketingKeyMessage">
          Key message or theme <Required />
        </FieldLabel>
        <Textarea
          id="marketingKeyMessage"
          name="marketingKeyMessage"
          rows={3}
          defaultValue={state.values?.marketingKeyMessage ?? defaults.keyMessage}
          onChange={() => markEdited('marketingKeyMessage')}
          aria-invalid={keyMessageError ? true : undefined}
          placeholder="What is the main takeaway?"
        />
        <FieldError>{keyMessageError}</FieldError>
      </Field>

      <Field data-invalid={sizeFormatError ? 'true' : undefined}>
        <FieldLabel>
          Size / format needed <Required />
        </FieldLabel>
        <FieldDescription>Select all that apply.</FieldDescription>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MARKETING_SIZE_FORMATS.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                name="marketingSizeFormat"
                value={s}
                checked={sizeFormats.includes(s)}
                onChange={(e) => toggleSizeFormat(s, e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              />
              {MARKETING_SIZE_FORMAT_LABELS[s]}
            </label>
          ))}
        </div>
        <FieldError>{sizeFormatError}</FieldError>
      </Field>

      {sizeFormats.includes('other') ? (
        <Field data-invalid={sizeFormatOtherError ? 'true' : undefined}>
          <FieldLabel htmlFor="marketingSizeFormatOther">
            Other size / format <Required />
          </FieldLabel>
          <Input
            id="marketingSizeFormatOther"
            name="marketingSizeFormatOther"
            autoComplete="off"
            defaultValue={
              state.values?.marketingSizeFormatOther ?? defaults.sizeFormatOther
            }
            onChange={() => markEdited('marketingSizeFormatOther')}
            aria-invalid={sizeFormatOtherError ? true : undefined}
            placeholder="Describe the size or format"
          />
          <FieldError>{sizeFormatOtherError}</FieldError>
        </Field>
      ) : null}
    </FieldGroup>
  )
}

function Required() {
  return (
    <span className="text-xs font-normal text-destructive" aria-hidden="true">
      *
    </span>
  )
}
