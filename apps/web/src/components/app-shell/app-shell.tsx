"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { MobileNav } from "./mobile-nav"

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
}

interface AppShellProps {
  children: React.ReactNode
  navItems: NavItem[]
  onSelect?: (id: string) => void
  headerTitle?: string
  headerRightAction?: React.ReactNode
}

export function AppShell({
  children,
  navItems,
  onSelect,
  headerTitle,
  headerRightAction,
}: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar items={navItems} activePath={pathname} />
        </div>

        {/* Tablet sidebar */}
        <div className="hidden md:block lg:hidden">
          <Sidebar items={navItems} activePath={pathname} collapsed />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            title={headerTitle}
            onMenuClick={() => setMobileOpen((prev) => !prev)}
            rightAction={headerRightAction}
          />
          <main className="flex-1">{children}</main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <MobileNav items={navItems} activePath={pathname} onSelect={onSelect} />
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface-sidebar border-r border-border shadow-lg">
            <Sidebar items={navItems} activePath={pathname} onSelect={(id) => { onSelect?.(id); setMobileOpen(false) }} />
          </aside>
        </div>
      )}
    </div>
  )
}
