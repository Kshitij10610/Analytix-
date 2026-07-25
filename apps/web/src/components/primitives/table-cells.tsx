import * as React from "react"
import { TrendIndicator } from "./trend-indicator"
import { Badge } from "./badge"

interface NumericCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: React.ReactNode
  unit?: React.ReactNode
}

export function NumericCell({ value, unit, className, children, ...props }: NumericCellProps) {
  return (
    <span className={["tabular-nums", className || ""].filter(Boolean).join(" ")} {...props}>
      {value}{unit && <span className="text-text-muted ml-1">{unit}</span>}
      {children}
    </span>
  )
}

interface CurrencyCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: React.ReactNode
}

export function CurrencyCell({ value, className, children, ...props }: CurrencyCellProps) {
  return (
    <span className={["tabular-nums", className || ""].filter(Boolean).join(" ")} {...props}>
      {value}
      {children}
    </span>
  )
}

interface PercentageCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: React.ReactNode
  trendStatus?: "positive" | "negative" | "neutral"
}

export function PercentageCell({ value, trendStatus, className, children, ...props }: PercentageCellProps) {
  return (
    <span className={["tabular-nums", className || ""].filter(Boolean).join(" ")} {...props}>
      {trendStatus ? (
        <TrendIndicator value={value as string} status={trendStatus} />
      ) : (
        value
      )}
      {children}
    </span>
  )
}

interface TrendCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string
  status: "positive" | "negative" | "neutral"
}

export function TrendCell({ value, status, className, children, ...props }: TrendCellProps) {
  return (
    <span className={className || ""} {...props}>
      <TrendIndicator value={value} status={status} />
      {children}
    </span>
  )
}

interface StatusCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string
  variant?: "neutral" | "primary" | "success" | "warning" | "error" | "info" | "positive" | "negative"
}

export function StatusCell({ status, variant = "neutral", className, children, ...props }: StatusCellProps) {
  return (
    <span className={["inline-flex", className || ""].filter(Boolean).join(" ")} {...props}>
      <Badge variant={variant}>{status}</Badge>
      {children}
    </span>
  )
}
