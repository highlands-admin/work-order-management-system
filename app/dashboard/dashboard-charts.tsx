'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type {
  Slice,
  StackedBreakdown,
  TrendPoint,
} from '@/lib/work-orders/dashboard-stats'

// Fixed status palette, shared by the status donut and the stacked breakdowns
// so a status reads as the same color everywhere.
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  open: '#0ea5e9',
  in_progress: '#8b5cf6',
  on_hold: '#f97316',
  done: '#10b981',
  closed: '#71717a',
  rejected: '#f43f5e',
}

export function DashboardCharts({
  byStatus,
  byCategory,
  byPriority,
  trend,
  rangeLabel,
  rangeSelector,
}: {
  byStatus: Slice[]
  byCategory: StackedBreakdown
  byPriority: StackedBreakdown
  trend: TrendPoint[]
  rangeLabel: string
  rangeSelector?: ReactNode
}) {
  const statusConfig = sliceConfig(byStatus, (s) => STATUS_COLORS[s.key])
  const statusData = byStatus.map((s) => ({
    ...s,
    fill: `var(--color-${s.key})`,
  }))
  const statusTotal = byStatus.reduce((sum, s) => sum + s.value, 0)

  const trendConfig = {
    created: { label: 'Created', color: 'var(--chart-1)' },
  } satisfies ChartConfig

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="By Status"
        description="Current distribution across all work orders"
      >
        <ChartContainer
          config={statusConfig}
          className="mx-auto aspect-square max-h-[260px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="key" hideLabel />}
            />
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="key"
              innerRadius={64}
              strokeWidth={3}
            >
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox)) return null
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-2xl font-semibold"
                      >
                        {statusTotal.toLocaleString()}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        className="fill-muted-foreground text-xs"
                      >
                        Total
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Created Over Time"
        description={`New Work Orders · ${rangeLabel}`}
        action={rangeSelector}
      >
        <ChartContainer config={trendConfig} className="h-[260px] w-full">
          <LineChart data={trend} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={24}
              tick={{ style: { fill: 'var(--foreground)' } }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="created"
              type="monotone"
              stroke="var(--color-created)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <StatusStackedCard
        title="By Category"
        description="Work Orders per category, split by status"
        breakdown={byCategory}
        // Cap the chart to the same fraction of the card that the filtered
        // bar count is of By Priority's (always 4) bars, so each bar stays
        // the same width as a Priority bar instead of stretching to fill the
        // card when fewer categories are shown.
        widthRatio={byCategory.data.length / byPriority.data.length}
      />

      <StatusStackedCard
        title="By Priority"
        description="Work Orders per priority, split by status"
        breakdown={byPriority}
      />
    </div>
  )
}

// A stacked bar chart: one bar per group (category or priority), segmented by
// status. Hovering a bar shows the per-status counts, and the legend maps the
// status colors.
function StatusStackedCard({
  title,
  description,
  breakdown,
  angledLabels = false,
  widthRatio,
}: {
  title: string
  description: string
  breakdown: StackedBreakdown
  // Angle the x-axis labels for groups with many long names (categories) so
  // every label fits without Recharts dropping some to avoid overlap.
  angledLabels?: boolean
  // Fraction (0-1) of the plotted bars' natural width to use, e.g. 0.5 when
  // there are half as many bars as the sibling chart. The chart itself (and
  // its background gridlines) always stays the full card width; only the
  // bars are inset from the edges, via XAxis padding, so a filtered-down
  // chart's bars match the sibling's bar width without shrinking the grid.
  widthRatio?: number
}) {
  const config: ChartConfig = Object.fromEntries(
    breakdown.statuses.map((s) => [
      s.key,
      { label: s.label, color: STATUS_COLORS[s.key] ?? 'var(--chart-1)' },
    ])
  )

  // Measure the chart's actual rendered width so the XAxis padding below can
  // be computed in the pixels Recharts expects (it has no percentage form).
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const xAxisPadding =
    widthRatio !== undefined && containerWidth > 0
      ? Math.max(0, Math.round((containerWidth * (1 - widthRatio)) / 2))
      : 0

  // The tooltip otherwise lists items in <Bar> render order too, which is
  // deliberately reversed for stacking -- sort back to canonical order.
  const statusOrder = new Map<string, number>(
    breakdown.statuses.map((s, i) => [s.key, i])
  )

  return (
    <ChartCard title={title} description={description}>
      <div ref={containerRef} className="w-full">
        <ChartContainer config={config} className="h-[260px] w-full">
          <BarChart data={breakdown.data} margin={{ top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              angle={angledLabels ? -30 : 0}
              textAnchor={angledLabels ? 'end' : 'middle'}
              height={angledLabels ? 84 : 30}
              padding={{ left: xAxisPadding, right: xAxisPadding }}
              tick={{ style: { fill: 'var(--foreground)' }, fontSize: 12 }}
            />
            <ChartTooltip
              cursor={false}
              // itemSorter only reorders Recharts' own default tooltip UI; it
              // has no effect on a custom `content` renderer like ours, so
              // the payload is filtered and sorted by hand before
              // ChartTooltipContent sees it: drop statuses this bar has none
              // of, then restore canonical (pending-first) order.
              content={({ active, label, payload }) => (
                <ChartTooltipContent
                  active={active}
                  label={label}
                  payload={
                    payload
                      ? payload
                          .filter((item) => Number(item.value) !== 0)
                          .sort(
                            (a, b) =>
                              (statusOrder.get(String(a.dataKey)) ?? 0) -
                              (statusOrder.get(String(b.dataKey)) ?? 0)
                          )
                      : payload
                  }
                />
              )}
            />
            {/* Declared bottom-to-top: closed/rejected first (base of the
                stack), pending last so it renders as the topmost segment.
                StackBar's rounding reads breakdown.statuses directly
                (canonical, pending-first order), unaffected by this reversal. */}
            {[...breakdown.statuses].reverse().map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="status"
                fill={`var(--color-${s.key})`}
                shape={
                  <StackBar statusKey={s.key} statuses={breakdown.statuses} />
                }
              />
            ))}
          </BarChart>
        </ChartContainer>
        {/* Recharts' <Legend> only offers auto-detected item order, which
            would follow the reversed <Bar> render order above -- render our
            own legend instead so it stays in canonical, pending-first order,
            matching ChartLegendContent's layout. */}
        <div className="flex items-center justify-center gap-4 pt-3">
          {breakdown.statuses.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: `var(--color-${s.key})` }}
              />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

function ChartCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader className="gap-1 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="font-heading text-lg font-semibold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-sm leading-snug">
              {description}
            </CardDescription>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-5">{children}</CardContent>
    </Card>
  )
}

function sliceConfig(
  slices: Slice[],
  color: (s: Slice) => string | undefined
): ChartConfig {
  return Object.fromEntries(
    slices.map((s) => [s.key, { label: s.label, color: color(s) ?? 'var(--chart-1)' }])
  )
}

// Custom stacked-bar segment that rounds the top corners only on the topmost
// non-zero status for each bar, so the cap is correct even when the first
// status (pending) has a count of zero.
function StackBar(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: Record<string, number | string>
  statusKey: string
  statuses: { key: string; label: string }[]
}) {
  const { x, y, width, height, fill, payload, statusKey, statuses } = props
  if (
    x == null ||
    y == null ||
    width == null ||
    height == null ||
    height <= 0
  ) {
    return null
  }

  const topKey = payload
    ? statuses.find((s) => Number(payload[s.key]) > 0)?.key
    : undefined

  if (topKey === statusKey) {
    return <path d={roundedTopRect(x, y, width, height, 4)} fill={fill} />
  }
  return <rect x={x} y={y} width={width} height={height} fill={fill} />
}

function roundedTopRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height))
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ')
}
