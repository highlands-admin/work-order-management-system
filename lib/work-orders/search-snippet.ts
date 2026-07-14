// Builds a short, highlightable excerpt of a work order's searchable text
// around the first place a search term matched, the way a search engine shows a
// snippet with the query terms emphasized. The matched text (title, notes, and
// so on) is concatenated into work_orders.search_text, so a snippet from that
// column shows why a row matched, including matches in fields the table does not
// display as columns (notes, description).

export type SnippetSegment = { text: string; match: boolean }

export type Snippet = {
  segments: SnippetSegment[]
  ellipsisStart: boolean
  ellipsisEnd: boolean
}

// Characters of context to keep on each side of the first match.
const CONTEXT_CHARS = 64

// Matching is plain case-insensitive substring, mirroring the ilike search, so
// the term is compared with indexOf rather than a regex (no escaping needed).
export function buildSnippet(
  text: string | null | undefined,
  term: string
): Snippet | null {
  if (!text || !term) return null

  const haystack = text.toLowerCase()
  const needle = term.toLowerCase()
  const first = haystack.indexOf(needle)
  if (first === -1) return null

  const start = Math.max(0, first - CONTEXT_CHARS)
  const end = Math.min(text.length, first + needle.length + CONTEXT_CHARS)
  const window = text.slice(start, end)
  const windowLower = window.toLowerCase()

  const segments: SnippetSegment[] = []
  let cursor = 0
  while (cursor < window.length) {
    const at = windowLower.indexOf(needle, cursor)
    if (at === -1) {
      segments.push({ text: window.slice(cursor), match: false })
      break
    }
    if (at > cursor) {
      segments.push({ text: window.slice(cursor, at), match: false })
    }
    segments.push({ text: window.slice(at, at + needle.length), match: true })
    cursor = at + needle.length
  }

  return {
    segments,
    ellipsisStart: start > 0,
    ellipsisEnd: end < text.length,
  }
}

export type LabeledSnippet = { label: string; snippet: Snippet }

// Finds which field a search term matched and builds a labeled snippet from it,
// the way search UIs show "matched in <field>". Fields are checked in order and
// the first hit wins, so pass them most-informative first. When none of the
// named fields contains the term but the concatenated blob does, the match is
// in the one remaining searched field (notes), so fall back to that: the caller
// passes the notes label and the blob to excerpt from.
export function buildLabeledSnippet(
  fields: { label: string; text: string | null | undefined }[],
  fallback: { label: string; text: string | null | undefined },
  term: string
): LabeledSnippet | null {
  for (const field of fields) {
    if (field.text && field.text.toLowerCase().includes(term.toLowerCase())) {
      const snippet = buildSnippet(field.text, term)
      if (snippet) return { label: field.label, snippet }
    }
  }
  const snippet = buildSnippet(fallback.text, term)
  return snippet ? { label: fallback.label, snippet } : null
}
