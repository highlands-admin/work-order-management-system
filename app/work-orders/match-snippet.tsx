'use client'

import type { LabeledSnippet } from '@/lib/work-orders/search-snippet'

// Renders a matched-text excerpt under a table row, labeled with the field the
// match came from and with the search term highlighted, so the reason a work
// order matched is clear even when the match was in a note or description
// rather than a displayed column.
export function MatchSnippet({ match }: { match: LabeledSnippet }) {
  const { label, snippet } = match
  return (
    <div className="flex items-baseline gap-2 text-xs leading-relaxed">
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 text-muted-foreground">
        <span className="sr-only">Match: </span>
        {snippet.ellipsisStart ? '…' : null}
        {snippet.segments.map((segment, i) =>
          segment.match ? (
            <mark
              key={i}
              className="rounded-[3px] bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100"
            >
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          )
        )}
        {snippet.ellipsisEnd ? '…' : null}
      </span>
    </div>
  )
}
