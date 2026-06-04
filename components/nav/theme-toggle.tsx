'use client'

import { RiMoonLine, RiSunLine } from '@remixicon/react'

import { Button } from '@/components/ui/button'

// Toggles the `dark` class on <html> and persists the choice. The matching
// inline script in the root layout applies the saved value before paint, so
// there is no flash of the wrong theme. Which icon shows is driven purely by
// the `dark` class via CSS, so there is no client/server state to reconcile.
export function ThemeToggle() {
  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark')
    try {
      window.localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {
      // Ignore storage failures (private mode, quota); the toggle still works
      // for the current session.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      title="Toggle theme"
    >
      <RiMoonLine className="dark:hidden" aria-hidden="true" />
      <RiSunLine className="hidden dark:block" aria-hidden="true" />
    </Button>
  )
}
