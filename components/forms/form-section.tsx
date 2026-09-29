import type { ReactNode } from 'react'

// A titled card for one group of form fields, matching the sections on the
// work order forms: a tinted header strip with the title and an optional
// description, then the content.
export function FormSection({
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
