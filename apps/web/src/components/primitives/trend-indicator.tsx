import * as React from "react"

interface TrendIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string
  status: "positive" | "negative" | "neutral"
  accessibleLabel?: string
}

const statusStyles: Record<NonNullable<TrendIndicatorProps["status"]>, string> = {
  positive: "text-positive-financial",
  negative: "text-negative-financial",
  neutral: "text-neutral-financial",
}

const statusIcon: Record<NonNullable<TrendIndicatorProps["status"]>, React.ReactNode> = {
  positive: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  negative: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  neutral: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
}

export function TrendIndicator({
  value,
  status,
  accessibleLabel,
  className,
  ...props
}: TrendIndicatorProps) {
  const label = accessibleLabel || `${status} trend: ${value}`

  return (
    <span
      className={["inline-flex items-center gap-1 font-medium", statusStyles[status], className || ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      {...props}
    >
      <span aria-hidden="true">{statusIcon[status]}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  )
}
