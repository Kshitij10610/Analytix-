import * as React from "react"

export interface BreadcrumbItem {
  label: React.ReactNode
  href?: string
  onClick?: () => void
}

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumb?: BreadcrumbItem[]
  primaryAction?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  primaryAction,
  secondaryAction,
  className,
}: PageHeaderProps) {
  const hasActions = Boolean(primaryAction || secondaryAction)

  return (
    <div className={["space-y-4", className || ""].filter(Boolean).join(" ")}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-body-sm text-text-muted">
          {breadcrumb.map((item, index) => {
            const isLast = index === breadcrumb.length - 1
            return (
              <React.Fragment key={index}>
                {index > 0 && <span aria-hidden="true">/</span>}
                {isLast ? (
                  <span className="text-text-secondary font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="hover:text-text-primary transition-colors"
                    disabled={!item.onClick && !item.href}
                  >
                    {item.label}
                  </button>
                )}
              </React.Fragment>
            )
          })}
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 min-w-0">
          <h1 className="text-h2 font-semibold text-text-heading break-words">{title}</h1>
          {description && <p className="text-body text-text-secondary break-words">{description}</p>}
        </div>
        {hasActions && (
          <div className="flex items-center gap-spacing-3 flex-wrap">
            {secondaryAction}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  )
}
