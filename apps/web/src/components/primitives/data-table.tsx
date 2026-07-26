"use client"

import * as React from "react"

interface DataTableColumn<T = Record<string, unknown>> {
  id: string
  header: React.ReactNode
  align?: "left" | "center" | "right"
  numeric?: boolean
  sortable?: boolean
  sortCompare?: (a: T, b: T) => number
  render?: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T = Record<string, unknown>> extends React.HTMLAttributes<HTMLDivElement> {
  columns: DataTableColumn<T>[]
  rows: T[]
  caption?: React.ReactNode
  emptyState?: React.ReactNode
}

type SortDirection = "asc" | "desc"

const alignmentStyles: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

function defaultSortCompare<T>(a: T, b: T): number {
  const av = (a as Record<string, unknown>)?.["id"] !== undefined ? (a as Record<string, unknown>)?.["id"] : a
  const bv = (b as Record<string, unknown>)?.["id"] !== undefined ? (b as Record<string, unknown>)?.["id"] : b
  if (typeof av === "number" && typeof bv === "number") return av - bv
  if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv)
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  return String(av).localeCompare(String(bv))
}

export function DataTable<T = Record<string, unknown>>({
  columns,
  rows,
  caption,
  emptyState = "No data available.",
  className,
  ...props
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc")
  const [canScroll, setCanScroll] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const activeColumn = columns.find((column) => column.id === sortColumn) || null
  const sortedRows = React.useMemo(() => {
    if (!activeColumn || !activeColumn.sortable) return rows
    const compare = activeColumn.sortCompare || defaultSortCompare
    const sorted = [...rows].sort(compare)
    return sortDirection === "asc" ? sorted : sorted.reverse()
  }, [rows, activeColumn, sortDirection])

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return
    if (sortColumn === column.id) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column.id)
      setSortDirection("asc")
    }
  }

  const checkScroll = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setCanScroll(el.scrollWidth > el.clientWidth + 1)
  }, [])

  React.useEffect(() => {
    checkScroll()
  }, [checkScroll, columns, rows])

  const outerClassName = [className || ""].filter(Boolean).join(" ")

  return (
    <div className={["w-full relative", outerClassName].filter(Boolean).join(" ")} {...props}>
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className="w-full overflow-x-auto overscroll-behavior-x-contain"
        role="region"
        aria-label="Data table"
      >
        <table className="w-full border-collapse">
          {caption && (
            <caption className="text-body-sm text-text-secondary mb-2 text-left">
              {caption}
            </caption>
          )}
          <thead>
            <tr>
              {columns.map((column) => {
                const isSortable = !!column.sortable
                const isActive = sortColumn === column.id
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                    className={[
                      "border-b border-border px-spacing-4 py-spacing-3 text-body-sm font-medium text-text-secondary bg-surface",
                      alignmentStyles[column.align || "left"],
                      column.numeric ? "tabular-nums whitespace-nowrap" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className={[
                          "inline-flex items-center gap-1 w-full bg-transparent border-0 p-0 cursor-pointer",
                          "text-left text-body-sm font-medium text-text-secondary",
                          "px-spacing-1 py-spacing-2",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="flex-1">{column.header}</span>
                        <span aria-hidden="true" className="text-text-muted">
                          {isActive ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-spacing-4 py-spacing-8 text-center text-body-sm text-text-muted"
                >
                  {emptyState}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border-subtle last:border-0">
                  {columns.map((column) => {
                    const value = (row as Record<string, unknown>)[column.id]
                    return (
                      <td
                        key={column.id}
                        className={[
                          "px-spacing-4 py-spacing-3 text-body text-text-primary",
                          alignmentStyles[column.align || "left"],
                          column.numeric ? "tabular-nums whitespace-nowrap" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {column.render ? column.render(row, rowIndex) : value != null ? String(value) : ""}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {canScroll && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-surface to-transparent"
          style={{ zIndex: 10 }}
        />
      )}
    </div>
  )
}
