// Print-only heading for a page that is printed in place. On screen, the page
// title, the filter chips, and the pagination row together say what the table
// is showing. None of that survives onto paper, so this block restates it once
// at the top of the sheet: what the list is, when it was printed, how it is
// sorted, how much of it is here, and which filters produced it.
//
// Hidden on screen (the page has its own heading there) and shown only for
// print.

export function PrintSheetHeader({
  title,
  meta,
  filterLines,
  landscape = false,
}: {
  title: string
  // One line under the title: row range, sort order, printed timestamp.
  meta: string
  // "Label: values" lines describing the active filters. Empty means no filter
  // was applied, which the sheet says outright rather than leaving blank.
  filterLines: string[]
  // A wide table does not fit a portrait page. Setting it per page keeps the
  // rest of the app on the portrait default from globals.css.
  landscape?: boolean
}) {
  return (
    <div className="hidden print:block">
      {landscape ? (
        <style>{'@page { size: letter landscape; margin: 0.4in; }'}</style>
      ) : null}

      <header className="mb-3 flex flex-col gap-1 border-b-2 border-foreground pb-2">
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{meta}</p>
        {filterLines.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {filterLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No filters applied.</p>
        )}
      </header>
    </div>
  )
}
