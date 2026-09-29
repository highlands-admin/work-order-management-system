import type { Metadata } from 'next'

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getProperties } from '@/lib/work-orders/fetch-properties'

import { AddPropertyForm } from './add-property-form'
import { PropertyRow } from './property-row'

export const metadata: Metadata = { title: 'Properties' }

export default async function PropertiesPage() {
  const properties = await getProperties()
  // Active properties first, each group alphabetical.
  const sorted = [...properties].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
  )

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

      <AddPropertyForm />

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        {sorted.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No properties yet. Add one above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((property) => (
                <PropertyRow
                  key={`${property.key}:${property.name}:${property.isActive}`}
                  property={property}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
