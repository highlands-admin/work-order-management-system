'use client'

import { useEffect, useState } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// This app manages dark mode with a `dark` class on <html> (set before paint by
// a script in the root layout), not next-themes, so the stock shadcn Sonner
// wrapper's useTheme() does not apply. Instead we read the class directly and
// keep the toaster in sync with the theme toggle via a MutationObserver.
export function Toaster(props: ToasterProps) {
  // Dark is the app's default view, so start there to avoid a first-paint flash.
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const root = document.documentElement
    const read = () =>
      setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
