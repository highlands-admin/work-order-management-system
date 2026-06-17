'use client'

import { RiDeleteBinLine, RiPencilLine } from '@remixicon/react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

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
import { formatDateTime } from '@/lib/datetime/format'

import type { AuthState } from '../(auth)/auth-state'
import { initialAuthState } from '../(auth)/auth-state'
import {
  addWorkOrderNoteAction,
  deleteWorkOrderNoteAction,
  updateWorkOrderNoteAction,
} from './actions'

export type NoteRow = {
  id: string
  body: string
  created_by: string
  created_at: string
  updated_at: string
}

const NOTE_TEXTAREA_CLASS = [
  'w-full resize-none rounded-md border bg-background px-3 py-2 text-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
].join(' ')

// userById maps a user UUID to a display label (full name or email fallback).
// It is a plain object so it serializes across the Server/Client boundary.
export function NotesSection({
  workOrderId,
  notes,
  userById,
  currentUserId,
  canModerate,
  timeZone,
}: {
  workOrderId: string | null
  notes: NoteRow[]
  userById: Record<string, string>
  currentUserId: string
  canModerate: boolean
  timeZone: string
}) {
  const disabled = workOrderId === null

  // Bind the work order ID so the action signature matches (workOrderId, prev, formData).
  // When disabled (create form), we still bind an empty string; the action will
  // never be called because the submit button is disabled.
  const boundAction = addWorkOrderNoteAction.bind(null, workOrderId ?? '')

  const [state, action] = useActionState<AuthState, FormData>(
    boundAction,
    initialAuthState
  )

  // Increment to reset the textarea after a successful submission. Using a key
  // on the textarea unmounts and remounts it, clearing the uncontrolled value.
  const [submitCount, setSubmitCount] = useState(0)
  const prevStateRef = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prevStateRef.current !== state) {
      if (state.status === 'success') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSubmitCount((c) => c + 1)
        toast.success('Note added.')
      } else if (state.status === 'error' && !state.fieldErrors?.body && state.message) {
        toast.error(state.message)
      }
    }
    prevStateRef.current = state
  }, [state])

  const bodyError = state.fieldErrors?.body?.[0]

  return (
    <section
      aria-labelledby="notes-title"
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none"
    >
      <header className="border-b bg-muted/30 px-6 py-4">
        <h2
          id="notes-title"
          className="font-heading text-base font-semibold tracking-tight"
        >
          Notes
          {notes.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({notes.length})
            </span>
          ) : null}
        </h2>
      </header>

      <div className="flex flex-col divide-y divide-foreground/5">
        {notes.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            No notes yet.
          </p>
        ) : (
          notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              authorLabel={userById[note.created_by] ?? note.created_by.slice(0, 8)}
              canEdit={note.created_by === currentUserId}
              canDelete={note.created_by === currentUserId || canModerate}
              timeZone={timeZone}
            />
          ))
        )}

        {/* Compose area */}
        <div className="px-6 py-6">
          {disabled ? (
            <p className="text-sm text-muted-foreground">
              Save the work order first to add notes.
            </p>
          ) : (
            <form action={action} noValidate className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="note-body"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Add a note
                </label>
                <textarea
                  key={submitCount}
                  id="note-body"
                  name="body"
                  rows={3}
                  placeholder="Write a note visible to everyone on this work order..."
                  aria-invalid={bodyError ? true : undefined}
                  className={`${NOTE_TEXTAREA_CLASS} ${
                    bodyError ? 'border-destructive' : 'border-input'
                  }`}
                />
                {bodyError ? (
                  <p className="text-xs text-destructive">{bodyError}</p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <SubmitButton label="Add note" pendingLabel="Adding…" size="sm" />
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function NoteItem({
  note,
  authorLabel,
  canEdit,
  canDelete,
  timeZone,
}: {
  note: NoteRow
  authorLabel: string
  canEdit: boolean
  canDelete: boolean
  timeZone: string
}) {
  const [editing, setEditing] = useState(false)

  const editAction = updateWorkOrderNoteAction.bind(null, note.id)
  const [editState, runEdit] = useActionState<AuthState, FormData>(
    editAction,
    initialAuthState
  )
  const deleteAction = deleteWorkOrderNoteAction.bind(null, note.id)
  const [deleteState, runDelete] = useActionState<AuthState, FormData>(
    deleteAction,
    initialAuthState
  )

  // Leave edit mode once the save succeeds. The ref guard keeps this from
  // looping on unrelated re-renders.
  const prevEditRef = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prevEditRef.current !== editState) {
      if (editState.status === 'success') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditing(false)
        toast.success('Note updated.')
      } else if (
        editState.status === 'error' &&
        !editState.fieldErrors?.body &&
        editState.message
      ) {
        toast.error(editState.message)
      }
    }
    prevEditRef.current = editState
  }, [editState])

  const prevDeleteRef = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prevDeleteRef.current === deleteState) return
    prevDeleteRef.current = deleteState
    if (deleteState.status === 'success') {
      toast.success('Note deleted.')
    } else if (deleteState.status === 'error' && deleteState.message) {
      toast.error(deleteState.message)
    }
  }, [deleteState])

  const initials = authorLabel
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const wasEdited = note.updated_at !== note.created_at

  const editBodyError = editState.fieldErrors?.body?.[0]

  return (
    <article className="group flex gap-4 px-6 py-5">
      {/* Author avatar */}
      <div
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      >
        {initials || '?'}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{authorLabel}</span>
          <time
            dateTime={note.created_at}
            className="text-xs text-muted-foreground"
          >
            {formatDateTime(note.created_at, timeZone)}
          </time>
          {wasEdited ? (
            <span className="text-xs text-muted-foreground/70">(edited)</span>
          ) : null}

          {(canEdit || canDelete) && !editing ? (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {/* focus-within keeps the actions reachable for keyboard users. */}
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Edit note"
                  title="Edit note"
                  onClick={() => setEditing(true)}
                >
                  <RiPencilLine />
                </Button>
              ) : null}
              {canDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete note"
                        title="Delete note"
                        className="text-muted-foreground hover:text-destructive"
                      />
                    }
                  >
                    <RiDeleteBinLine />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>Delete note?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the note. This action cannot be
                      undone.
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <form action={runDelete}>
                        <SubmitButton
                          label="Delete"
                          pendingLabel="Deleting…"
                          size="sm"
                          className="w-full bg-destructive text-white shadow-destructive/20 hover:bg-destructive/90 sm:w-auto"
                        />
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </span>
          ) : null}
        </div>

        {editing ? (
          <form action={runEdit} noValidate className="mt-1 flex flex-col gap-2">
            <textarea
              name="body"
              rows={3}
              defaultValue={note.body}
              autoFocus
              aria-invalid={editBodyError ? true : undefined}
              className={`${NOTE_TEXTAREA_CLASS} ${
                editBodyError ? 'border-destructive' : 'border-input'
              }`}
            />
            {editBodyError ? (
              <p className="text-xs text-destructive">{editBodyError}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <SubmitButton label="Save" pendingLabel="Saving…" size="sm" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {note.body}
          </p>
        )}

      </div>
    </article>
  )
}
