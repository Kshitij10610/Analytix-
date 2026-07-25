import * as React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "./card"
import { TrendIndicator } from "./trend-indicator"

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  primaryValue: string
  secondaryValue?: string
  trend?: string
  trendStatus?: "positive" | "negative" | "neutral"
  comparisonPeriod?: string
  helperText?: string
  icon?: React.ReactNode
  loading?: boolean
}

export function MetricCard({
  label,
  primaryValue,
  secondaryValue,
  trend,
  trendStatus,
  comparisonPeriod,
  helperText,
  icon,
  loading = false,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card padding="md" className={["flex flex-col", className || ""].filter(Boolean).join(" ")} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle as="h4" className="text-label font-medium text-text-secondary">
          {label}
        </CardTitle>
        {icon && (
          <span className="h-4 w-4 text-text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2" aria-label="Loading metric" role="status">
            <div className="h-8 w-24 bg-border animate-pulse rounded" />
            {secondaryValue && <div className="h-4 w-16 bg-border animate-pulse rounded" />}
          </div>
        ) : (
          <>
            <div className="text-h3 font-semibold text-text-primary tabular-nums break-all">
              {primaryValue}
            </div>
            {secondaryValue && (
              <div className="text-body-sm text-text-secondary mt-1">{secondaryValue}</div>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {trend && trendStatus && (
                <TrendIndicator value={trend} status={trendStatus} />
              )}
              {comparisonPeriod && (
                <span className="text-body-sm text-text-muted">{comparisonPeriod}</span>
              )}
            </div>
            {helperText && (
              <p className="text-caption text-text-muted mt-2">{helperText}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
