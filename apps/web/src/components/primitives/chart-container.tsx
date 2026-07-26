import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card"

interface ChartContainerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  headerAction?: React.ReactNode
  footer?: React.ReactNode
  loading?: boolean
  empty?: boolean
  error?: boolean
  emptyStateMessage?: React.ReactNode
  errorStateMessage?: React.ReactNode
  children?: React.ReactNode
}

export function ChartContainer({
  title,
  description,
  headerAction,
  footer,
  loading = false,
  empty = false,
  error = false,
  emptyStateMessage = "No data available for this period.",
  errorStateMessage = "Unable to load chart data.",
  className,
  children,
  ...props
}: ChartContainerProps) {
  const stateClassName = loading || empty || error ? "flex items-center justify-center" : ""

  return (
    <Card padding="md" className={["w-full", className || ""].filter(Boolean).join(" ")} {...props}>
      {(title || description || headerAction) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col space-y-spacing-2">
            {title && (
              <CardTitle as="h3" className="text-h3 font-semibold text-text-heading">
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">{headerAction}</div>
          )}
        </CardHeader>
      )}
      <CardContent className={`min-h-[200px] ${stateClassName}`}>
        {loading ? (
          <div aria-label="Loading chart" role="status" className="w-full">
            <div className="h-4 w-24 bg-border animate-pulse rounded mb-4" />
            <div className="h-[200px] bg-surface-elevated border border-border rounded flex items-center justify-center">
              <div className="space-y-2 w-full px-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-2 w-full bg-border animate-pulse rounded" style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-body-sm text-error">{errorStateMessage}</p>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-body-sm text-text-muted">{emptyStateMessage}</p>
          </div>
        ) : (
          <div className="w-full min-h-[200px]">
            {children}
          </div>
        )}
      </CardContent>
      {footer && (
        <CardFooter>
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}
