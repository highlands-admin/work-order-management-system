import type { SupabaseClient } from '@supabase/supabase-js'

import { PROPERTIES, type Property } from '@/lib/schemas/work-order'

const PROPERTY_SET = new Set<string>(PROPERTIES)

// The facilities the signed-in user has chosen to default their work order views
// to. Empty when they have no preference. RLS scopes the row to the caller, and
// stored values are re-validated against the current enum so a removed facility
// can't leak through.
export async function fetchFacilityPreferences(
  supabase: SupabaseClient
): Promise<Property[]> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('facilities')
    .maybeSingle()

  if (error || !data) return []
  const facilities = (data.facilities ?? []) as string[]
  return facilities.filter((f): f is Property => PROPERTY_SET.has(f))
}
