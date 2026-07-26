import * as React from "react"
import Link from "next/link"

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
}

interface SidebarProps {
  items: NavItem[]
  activePath?: string
  onNavigate?: (id: string) => void
  collapsed?: boolean
}

export function Sidebar({ items, activePath, onNavigate, collapsed = false }: SidebarProps) {
  return (
    <aside className={["h-full border-r border-border bg-surface-sidebar flex flex-col", collapsed ? "w-16" : "w-64"].join(" ")}>
      <div className={["h-14 flex items-center border-b border-border-subtle", collapsed ? "px-spacing-3 justify-center" : "px-spacing-4"].join(" ")}>
        {collapsed ? (
          <span className="text-h4 font-semibold text-text-heading" aria-hidden="true">A</span>
        ) : (
          <span className="text-h4 font-semibold text-text-heading">Analytix</span>
        )}
      </div>
      <nav className={["flex-1", collapsed ? "py-spacing-4" : "py-spacing-4"].join(" ")} aria-label="Main">
        <ul className={["space-y-spacing-1", collapsed ? "px-spacing-2" : "px-spacing-3"].join(" ")}>
          {items.map((item) => {
            const isActive = activePath === item.id || activePath === item.href
            const href = item.href || item.id
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  onClick={onNavigate ? () => onNavigate(item.id) : undefined}
                  className={[
                    "w-full flex items-center gap-spacing-3 px-spacing-3 py-spacing-2 rounded-md text-left transition-colors",
                    "min-h-[44px]",
                    isActive
                      ? "bg-surface-selected text-text-primary"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="h-4 w-4 flex-shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  {!collapsed && <span className="text-body-sm font-medium">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
