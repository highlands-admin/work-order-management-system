import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuthState } from '@/app/(auth)/auth-state'
import type { PropertyOption } from '@/lib/work-orders/properties'

import { AddPropertyForm } from './add-property-form'
import {
  PropertyRow,
  type RenamePropertyAction,
  type SetPropertyActiveAction,
} from './property-row'

// The add form and the property table for one organization. The platform
// organization page passes actions bound to the organization being
// configured.
export function PropertiesManager({
  properties,
  addAction,
  renameAction,
  setActiveAction,
}: {
  properties: PropertyOption[]
  addAction: (prev: AuthState, formData: FormData) => Promise<AuthState>
  renameAction: RenamePropertyAction
  setActiveAction: SetPropertyActiveAction
}) {
  // Active properties first, each group alphabetical.
  const sorted = [...properties].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
  )

  return (
    <div className="flex flex-col gap-6">
      <AddPropertyForm addAction={addAction} />

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
                  renameAction={renameAction}
                  setActiveAction={setActiveAction}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
