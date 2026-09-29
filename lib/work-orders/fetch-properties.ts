import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import type { PropertyOption } from '@/lib/work-orders/properties'

type PropertyRow = {
  key: string
  name: string
  is_active: boolean
}

// Loads the signed-in user's organization properties, sorted by name. RLS
// scopes the query to the caller's organization. Wrapped in React cache so a
// page and the components it renders share one query per request.
export const getProperties = cache(async function getProperties(): Promise<
  PropertyOption[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('key, name, is_active')
    .order('name')

  if (error) {
    console.error('Failed to load properties', error)
    return []
  }

  return ((data ?? []) as PropertyRow[]).map((row) => ({
    key: row.key,
    name: row.name,
    isActive: row.is_active,
  }))
})
