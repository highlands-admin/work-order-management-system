import { useEffect, useState } from 'react'

// Returns whether a message tied to `key` is still visible. Visibility is
// derived synchronously so the alert shows on the same render the key arrives;
// after `delay` ms the key is marked dismissed and the hook returns false.
// Pass a stable identifier (e.g. the message string) so a fresh message resets
// the countdown.
export function useAutoDismiss(key: unknown, delay: number = 10000): boolean {
  const [dismissedKey, setDismissedKey] = useState<unknown>(null)
  useEffect(() => {
    if (!key) return
    const id = setTimeout(() => setDismissedKey(key), delay)
    return () => clearTimeout(id)
  }, [key, delay])
  return Boolean(key) && key !== dismissedKey
}
