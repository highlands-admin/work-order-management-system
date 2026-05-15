import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card className="gap-6 py-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {children}
        {footer ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
