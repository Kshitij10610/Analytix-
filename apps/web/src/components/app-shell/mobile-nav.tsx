import * as React from "react"

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

interface MobileNavProps {
  items: NavItem[]
  activePath?: string
  onNavigate?: (id: string) => void
}

export function MobileNav({ items, activePath, onNavigate }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-surface-navbar z-50" aria-label="Mobile">
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const isActive = activePath === item.id
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onNavigate?.(item.id)}
                className={[
                  "w-full flex flex-col items-center justify-center gap-1 py-2 min-h-[56px]",
                  isActive ? "text-primary" : "text-text-muted",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="h-5 w-5" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-caption font-medium">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
