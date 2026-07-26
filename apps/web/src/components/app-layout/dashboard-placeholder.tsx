import * as React from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/primitives"

interface DashboardPlaceholderProps {
  state?: "loading" | "empty" | "error"
  title?: string
  description?: string
  message?: string
  className?: string
}

const defaultMessages = {
  loading: "Loading...",
  empty: "No data available for this period.",
  error: "Unable to load data.",
}

export function DashboardPlaceholder({
  state = "loading",
  title,
  description,
  message,
  className,
}: DashboardPlaceholderProps) {
  const resolvedMessage = message || defaultMessages[state]

  return (
    <Card padding="md" className={["w-full", className || ""].filter(Boolean).join(" ")}>
      <CardHeader>
        <CardTitle as="h3">{title || "Dashboard Section"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
          {state === "loading" && (
            <div className="w-full space-y-3">
              <div className="h-4 w-32 bg-border animate-pulse rounded" />
              <div className="h-4 w-full bg-border animate-pulse rounded" />
              <div className="h-4 w-full bg-border animate-pulse rounded" />
            </div>
          )}
          {(state === "empty" || state === "error") && (
            <p className={`text-body-sm ${state === "error" ? "text-error" : "text-text-muted"}`}>
              {resolvedMessage}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
