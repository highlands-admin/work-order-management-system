import type { Metadata } from 'next'

import { PropertiesManager } from '@/components/properties/properties-manager'
import { getProperties } from '@/lib/work-orders/fetch-properties'

import {
  addPropertyAction,
  renamePropertyAction,
  setPropertyActiveAction,
} from '../actions'

export const metadata: Metadata = { title: 'Properties' }

export default async function PropertiesPage() {
  const properties = await getProperties()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-muted-foreground">
          The facilities offered on work order forms. Retiring a property hides
          it from new work orders. Existing work orders keep it, and it stays
          available as a filter.
        </p>
      </div>

      <PropertiesManager
        properties={properties}
        addAction={addPropertyAction}
        renameAction={renamePropertyAction}
        setActiveAction={setPropertyActiveAction}
      />
    </div>
  )
}
