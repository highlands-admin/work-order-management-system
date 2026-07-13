'use client'

import { useState } from 'react'

import type { WorkOrderStatus } from '@/lib/schemas/work-order'
import type { AssignableUser } from '@/lib/work-orders/assignable-users'
import { writeBoardColumnsCookie } from '@/lib/work-orders/board-columns-cookie'
import type { WorkOrderFilters } from '@/lib/work-orders/filters'

import { FilterBar } from '../filter-bar'
import type { WorkOrderListItem } from '../work-orders-table'
import { BoardColumnSelector } from './board-column-selector'
import { KanbanBoard } from './kanban-board'

// Owns the board's visible-column state so the column picker can live in the
// filter toolbar (shared row) while the board below reads the same selection.
// The board data always covers every status; the picker only changes which
// columns render, and persists the choice to a cookie for the next visit.
export function BoardWorkspace({
  workOrders,
  timeZone,
  users,
  initialColumns,
  initialFilters,
  emptyMessage,
  error,
}: {
  workOrders: WorkOrderListItem[]
  timeZone: string
  users: AssignableUser[]
  initialColumns: WorkOrderStatus[]
  initialFilters: WorkOrderFilters
  emptyMessage: string
  error: string | null
}) {
  const [visibleColumns, setVisibleColumns] =
    useState<WorkOrderStatus[]>(initialColumns)

  function changeColumns(next: WorkOrderStatus[]) {
    setVisibleColumns(next)
    writeBoardColumnsCookie(next)
  }

  return (
    <>
      <FilterBar
        showAssignee={false}
        initialFilters={initialFilters}
        trailingActions={
          <BoardColumnSelector
            selected={visibleColumns}
            onChange={changeColumns}
          />
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <KanbanBoard
        workOrders={workOrders}
        timeZone={timeZone}
        users={users}
        visibleColumns={visibleColumns}
        emptyMessage={emptyMessage}
      />
    </>
  )
}
