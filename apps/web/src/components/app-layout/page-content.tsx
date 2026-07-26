import * as React from "react"

interface PageContentProps {
  children: React.ReactNode
  maxWidth?: "content" | "dashboard" | "reading" | "full"
  className?: string
}

const maxWidthStyles: Record<string, string> = {
  content: "max-w-content mx-auto",
  dashboard: "max-w-dashboard mx-auto",
  reading: "max-w-reading mx-auto",
  full: "max-w-full",
}

export function PageContent({ children, maxWidth = "content", className }: PageContentProps) {
  return (
    <div className={["px-4 py-6 sm:px-6 lg:px-8", maxWidthStyles[maxWidth], className || ""].filter(Boolean).join(" ")}>
      <div className="space-y-8">{children}</div>
    </div>
  )
}

interface PageSectionProps {
  children: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  className?: string
  fullWidth?: boolean
}

export function PageSection({ children, title, description, className, fullWidth = false }: PageSectionProps) {
  return (
    <section className={["space-y-4", className || ""].filter(Boolean).join(" ")}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-h3 font-semibold text-text-heading">{title}</h2>}
          {description && <p className="text-body-sm text-text-secondary">{description}</p>}
        </div>
      )}
      <div className={fullWidth ? "-mx-4 sm:-mx-6 lg:-mx-8" : ""}>
        {fullWidth ? <div className="px-4 sm:px-6 lg:px-8">{children}</div> : children}
      </div>
    </section>
  )
}
