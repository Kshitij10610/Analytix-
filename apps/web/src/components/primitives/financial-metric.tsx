import * as React from "react"
import { TrendIndicator } from "./trend-indicator"

interface FinancialMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string
  unit?: string
  change?: string
  trendStatus?: "positive" | "negative" | "neutral"
  comparisonText?: string
  statusContext?: string
  helperText?: string
}

export function FinancialMetric({
  label,
  value,
  unit,
  change,
  trendStatus,
  comparisonText,
  statusContext,
  helperText,
  className,
  ...props
}: FinancialMetricProps) {
  return (
    <div className={["flex flex-col", className || ""].filter(Boolean).join(" ")} {...props}>
      <span className="text-label font-medium text-text-secondary">{label}</span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-h3 font-semibold text-text-primary tabular-nums">{value}</span>
        {unit && <span className="text-body-sm text-text-muted">{unit}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        {change && trendStatus && (
          <TrendIndicator value={change} status={trendStatus} />
        )}
        {comparisonText && (
          <span className="text-body-sm text-text-muted">{comparisonText}</span>
        )}
      </div>
      {statusContext && (
        <span className="text-body-sm text-text-muted mt-1">{statusContext}</span>
      )}
      {helperText && (
        <span className="text-caption text-text-muted mt-1">{helperText}</span>
      )}
    </div>
  )
}
