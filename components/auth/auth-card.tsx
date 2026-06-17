import type { ReactNode } from 'react'

// The auth screens live in a split-screen layout (see app/(auth)/layout.tsx).
// The form sits in a bordered card on the form column: heading, the form, and an
// optional footer link.
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm dark:shadow-none sm:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {children}
      </div>

      {footer ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </div>
  )
}
