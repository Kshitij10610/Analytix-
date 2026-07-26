import * as React from "react"

interface HeaderProps {
  title?: string
  onMenuClick?: () => void
  rightAction?: React.ReactNode
}

export function Header({ title, onMenuClick, rightAction }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-surface-navbar flex items-center justify-between px-spacing-4">
      <div className="flex items-center gap-spacing-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        {title && <h1 className="text-h4 font-semibold text-text-heading">{title}</h1>}
      </div>
      {rightAction && <div className="flex items-center gap-spacing-2">{rightAction}</div>}
    </header>
  )
}
