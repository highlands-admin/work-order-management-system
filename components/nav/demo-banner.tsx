import { signOutAction } from '@/app/(auth)/actions'
import { createClient } from '@/lib/supabase/server'

// A bar pinned to the top of every page while a platform admin is signed in
// as an organization's read-only demo account, naming the organization so it
// is always clear whose view this is. Exiting signs the demo out.
export async function DemoBanner() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { demo?: boolean } | undefined
  if (claims?.demo !== true) return null

  // Members can read their own organization's row, so this is the demo's org.
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .maybeSingle()
  const orgName = (org as { name?: string } | null)?.name ?? 'this organization'

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-2 text-sm text-amber-950 shadow-md">
      <span className="font-semibold">Viewing as {orgName}</span>
      <span className="hidden sm:inline">
        Demo, read-only. Nothing you do here is saved, and no emails go out.
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
