// Client-side draft persistence for the new work order form. Values are kept in
// sessionStorage so an accidental navigation away within the browser session
// does not lose an in-progress work order. Storage access is best-effort:
// private-mode or quota errors are swallowed rather than breaking the form.

const DRAFT_KEY = 'work-order-draft:new'

export type WorkOrderDraft = {
  // Mirrors AuthState.values (a flat string map, multi-selects comma-joined) so
  // the same wiring that rehydrates the form after a failed submit also restores
  // a saved draft.
  values: Record<string, string>
  notes: string[]
  // Serialized attachment metadata (JSON per uploaded file). The bytes already
  // live in the bucket, so only the references are persisted.
  attachments: string[]
}

function isDraftEmpty(draft: WorkOrderDraft): boolean {
  const hasValue = Object.values(draft.values).some((v) => v.trim().length > 0)
  const hasNote = draft.notes.some((n) => n.trim().length > 0)
  const hasAttachment = draft.attachments.length > 0
  return !hasValue && !hasNote && !hasAttachment
}

export function readStoredDraft(): WorkOrderDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WorkOrderDraft> | null
    if (!parsed || typeof parsed !== 'object') return null
    const values =
      parsed.values && typeof parsed.values === 'object' ? parsed.values : {}
    const notes = Array.isArray(parsed.notes)
      ? parsed.notes.filter((n): n is string => typeof n === 'string')
      : []
    const attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.filter((a): a is string => typeof a === 'string')
      : []
    const draft: WorkOrderDraft = { values, notes, attachments }
    return isDraftEmpty(draft) ? null : draft
  } catch {
    return null
  }
}

export function saveDraft(draft: WorkOrderDraft): void {
  if (typeof window === 'undefined') return
  try {
    if (isDraftEmpty(draft)) {
      window.sessionStorage.removeItem(DRAFT_KEY)
      return
    }
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Storage unavailable or full; drafting is best-effort.
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Ignore: nothing to clean up if storage is unavailable.
  }
}

// Snapshot the live form into a draft. Empty values are dropped so unset fields
// fall back to their placeholders and server-provided defaults on restore, and
// file inputs (attachments) are skipped since their bytes cannot be persisted.
// Notes are kept as an array so a note containing a comma is not corrupted.
export function readFormDraft(form: HTMLFormElement): WorkOrderDraft {
  const formData = new FormData(form)
  const grouped: Record<string, string[]> = {}
  const notes: string[] = []
  const attachments: string[] = []

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    if (key === 'note') {
      notes.push(value)
      continue
    }
    // Attachment metadata is JSON, so it is kept per entry rather than joined.
    if (key === 'attachment') {
      attachments.push(value)
      continue
    }
    ;(grouped[key] ??= []).push(value)
  }

  const values: Record<string, string> = {}
  for (const key of Object.keys(grouped)) {
    const joined = grouped[key].join(',')
    if (joined.trim().length > 0) values[key] = joined
  }

  return {
    values,
    notes: notes.filter((n) => n.trim().length > 0),
    attachments,
  }
}
