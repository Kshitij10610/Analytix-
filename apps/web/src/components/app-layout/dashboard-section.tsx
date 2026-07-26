import * as React from "react"

interface DashboardSectionProps {
  children: React.ReactNode
  className?: string
}

export function DashboardSection({ children, className }: DashboardSectionProps) {
  return (
    <section className={["space-y-6", className || ""].filter(Boolean).join(" ")}>
      {children}
    </section>
  )
}

interface DashboardGridProps {
  children: React.ReactNode
  className?: string
  columns?: 1 | 2 | 3 | 4
}

const gridCols: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
}

export function DashboardGrid({ children, className, columns = 4 }: DashboardGridProps) {
  return (
    <div className={["grid gap-4 sm:gap-6", gridCols[columns], className || ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  )
}

interface DashboardRowProps {
  children: React.ReactNode
  className?: string
}

export function DashboardRow({ children, className }: DashboardRowProps) {
  return (
    <div className={["grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6", className || ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  )
}

interface DashboardColumnProps {
  children: React.ReactNode
  className?: string
  span?: 1 | 2 | 3
}

const spanCols: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
}

export function DashboardColumn({ children, className, span = 1 }: DashboardColumnProps) {
  return (
    <div className={["flex flex-col gap-4 sm:gap-6", spanCols[span], className || ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  )
}
