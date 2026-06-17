'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { RiCalendarEventLine } from '@remixicon/react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { ResolutionDialog } from '@/components/work-orders/resolution-dialog'
import { PriorityBadge } from '@/components/work-orders/work-order-badge'
import { formatDate } from '@/lib/datetime/format'
import {
  CATEGORY_LABELS,
  MAIN_TABLE_STATUSES,
  STATUS_LABELS,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'

import { changeWorkOrderStatusAction } from '../actions'
import { type WorkOrderListItem } from '../work-orders-table'

type Board = Record<WorkOrderStatus, WorkOrderListItem[]>

function groupByStatus(items: WorkOrderListItem[]): Board {
  const groups = Object.fromEntries(
    MAIN_TABLE_STATUSES.map((s) => [s, [] as WorkOrderListItem[]])
  ) as Board
  for (const item of items) {
    if (groups[item.status]) groups[item.status].push(item)
  }
  return groups
}

// A stable fingerprint of every row's id and status, used to re-sync the board
// from fresh server data after a status change is revalidated.
function signature(items: WorkOrderListItem[]): string {
  return items
    .map((i) => `${i.id}:${i.status}`)
    .sort()
    .join('|')
}

export function KanbanBoard({
  workOrders,
  timeZone,
}: {
  workOrders: WorkOrderListItem[]
  timeZone: string
}) {
  const [board, setBoard] = useState<Board>(() => groupByStatus(workOrders))
  const [serverSig, setServerSig] = useState(() => signature(workOrders))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A drop into the Done column is held here until the resolution modal is
  // confirmed; the card only moves once a resolution is provided.
  const [doneMove, setDoneMove] = useState<{
    cardId: string
    from: WorkOrderStatus
    card: WorkOrderListItem
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Adopt fresh server data (after a revalidation) once it differs from what we
  // last synced. Our own optimistic moves leave the prop unchanged until the
  // action's revalidation lands, so this does not clobber an in-flight drag.
  const incomingSig = signature(workOrders)
  if (incomingSig !== serverSig) {
    setServerSig(incomingSig)
    setBoard(groupByStatus(workOrders))
  }

  const sensors = useSensors(
    // Mouse: drag after a small movement. Touch: press-and-hold, so a quick
    // swipe still scrolls the column instead of grabbing a card. Keyboard:
    // focus a card, space to pick up, arrows to move, space to drop.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  const activeCard = activeId
    ? Object.values(board)
        .flat()
        .find((c) => c.id === activeId)
    : null

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  // Optimistically move the card, then commit via the action and revert on
  // failure. Shared by the immediate path and the Done path (after the modal).
  function commitMove(
    cardId: string,
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    card: WorkOrderListItem,
    resolution?: string
  ) {
    setBoard((prev) => ({
      ...prev,
      [from]: prev[from].filter((c) => c.id !== cardId),
      [to]: [{ ...card, status: to }, ...prev[to]],
    }))
    setError(null)

    startTransition(async () => {
      const result = await changeWorkOrderStatusAction(cardId, to, resolution)
      if (result.status === 'error') {
        // Revert the card to its original column.
        setBoard((prev) => ({
          ...prev,
          [to]: prev[to].filter((c) => c.id !== cardId),
          [from]: [{ ...card, status: from }, ...prev[from]],
        }))
        setError(result.message ?? 'Could not update the status.')
      }
    })
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const cardId = String(active.id)
    const from = active.data.current?.status as WorkOrderStatus | undefined
    const to = String(over.id) as WorkOrderStatus
    if (
      !from ||
      from === to ||
      !(MAIN_TABLE_STATUSES as readonly string[]).includes(to)
    ) {
      return
    }

    const card = board[from].find((c) => c.id === cardId)
    if (!card) return

    // Moving to Done requires a resolution: hold the move and prompt first.
    if (to === 'done') {
      setDoneMove({ cardId, from, card })
      return
    }

    commitMove(cardId, from, to, card)
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DndContext
        // A stable id keeps @dnd-kit's accessibility ids (aria-describedby)
        // deterministic across server and client, avoiding a hydration mismatch.
        id="my-work-orders-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {MAIN_TABLE_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              cards={board[status]}
              timeZone={timeZone}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <CardShell dragging>
              <CardBody card={activeCard} timeZone={timeZone} />
            </CardShell>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ResolutionDialog
        open={doneMove !== null}
        onOpenChange={(open) => {
          if (!open) setDoneMove(null)
        }}
        pending={isPending}
        onConfirm={(resolution) => {
          if (!doneMove) return
          commitMove(
            doneMove.cardId,
            doneMove.from,
            'done',
            doneMove.card,
            resolution
          )
          setDoneMove(null)
        }}
        onCancel={() => setDoneMove(null)}
      />
    </div>
  )
}

function Column({
  status,
  cards,
  timeZone,
}: {
  status: WorkOrderStatus
  cards: WorkOrderListItem[]
  timeZone: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section className="flex w-72 shrink-0 flex-col gap-2">
      <header className="flex items-center gap-2 px-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {STATUS_LABELS[status]}
        </h3>
        <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-32 flex-1 flex-col gap-2 rounded-xl bg-muted/30 p-2 ring-1 ring-foreground/5 transition-colors',
          isOver && 'bg-primary/5 ring-2 ring-primary/40'
        )}
      >
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} timeZone={timeZone} />
        ))}
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
            Drop a work order here
          </p>
        ) : null}
      </div>
    </section>
  )
}

function DraggableCard({
  card,
  timeZone,
}: {
  card: WorkOrderListItem
  timeZone: string
}) {
  const router = useRouter()
  const { setNodeRef, listeners, attributes, transform, isDragging } =
    useDraggable({ id: card.id, data: { status: card.status } })
  const start = useRef<{ x: number; y: number } | null>(null)

  return (
    <CardShell
      nodeRef={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : undefined,
      }}
      aria-label={`${card.work_order_code}: ${card.title}`}
      {...attributes}
      {...listeners}
      // The whole card is draggable, but a plain click should still open it.
      // Compare where the pointer went down vs. up so the click that ends a
      // drag does not navigate.
      onPointerDownCapture={(event) => {
        start.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        const from = start.current
        if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 6) {
          return
        }
        router.push(`/work-orders/${card.id}`)
      }}
    >
      <CardBody card={card} timeZone={timeZone} />
    </CardShell>
  )
}

function CardShell({
  children,
  nodeRef,
  dragging,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  nodeRef?: (node: HTMLElement | null) => void
  dragging?: boolean
}) {
  return (
    <div
      ref={nodeRef}
      className={cn(
        'rounded-lg bg-card p-3 ring-1 ring-foreground/10 shadow-md dark:shadow-none outline-none',
        dragging
          ? 'cursor-grabbing shadow-lg'
          : 'cursor-grab transition-shadow hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function CardBody({
  card,
  timeZone,
}: {
  card: WorkOrderListItem
  timeZone: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
          {card.work_order_code}
        </span>
        <PriorityBadge priority={card.priority} />
      </div>
      <p className="line-clamp-2 text-sm font-medium leading-snug">
        {card.title}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{CATEGORY_LABELS[card.category]}</span>
        {card.due_at ? (
          <span className="inline-flex items-center gap-1">
            <RiCalendarEventLine
              className="size-3.5 shrink-0 text-muted-foreground/70"
              aria-hidden="true"
            />
            {formatDate(card.due_at, timeZone)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
