import { signOutAction } from '@/app/(auth)/actions'
import { createClient } from '@/lib/supabase/server'

// A strip across every page while a platform admin is signed in as an
// organization's read-only demo account. Exiting signs the demo out.
export async function DemoBanner() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { demo?: boolean } | undefined
  if (claims?.demo !== true) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Demo view, read-only. Nothing you do here is saved, and no emails go
        out.
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900"
        >
          Exit demo
        </button>
      </form>
    </div>
  )
}
