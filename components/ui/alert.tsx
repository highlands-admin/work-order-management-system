import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800 *:data-[slot=alert-description]:text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:*:data-[slot=alert-description]:text-emerald-300",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800 *:data-[slot=alert-description]:text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 dark:*:data-[slot=alert-description]:text-amber-300",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-800 *:data-[slot=alert-description]:text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 dark:*:data-[slot=alert-description]:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const VARIANT_ICONS = {
  success: RiCheckboxCircleLine,
  warning: RiAlertLine,
  destructive: RiCloseCircleLine,
} as const

function Alert({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon =
    variant && variant in VARIANT_ICONS
      ? VARIANT_ICONS[variant as keyof typeof VARIANT_ICONS]
      : null
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
