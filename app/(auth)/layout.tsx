import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/nav/theme-toggle'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted px-4 py-12">
      {/* Soft teal glow anchors the brand without competing with the form. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}
