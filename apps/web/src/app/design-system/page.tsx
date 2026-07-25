"use client"

import { useState, useEffect } from "react"

interface Swatch {
  token: string
  hex: string
  description: string
  isText?: boolean
  isSurface?: boolean
}

const cssVarMap: Record<string, string> = {
  "--primary": "#2563eb",
  "--secondary": "#14b8a6",
  "--accent": "#d946ef",
  "--finance-accent": "#059669",
  "--ai-accent": "#e879f9",
  "--neutral-50": "#fafafa",
  "--neutral-100": "#f4f4f5",
  "--neutral-200": "#e4e4e7",
  "--neutral-300": "#d4d4d8",
  "--neutral-400": "#a1a1aa",
  "--neutral-500": "#71717a",
  "--neutral-600": "#52525b",
  "--neutral-700": "#3f3f46",
  "--neutral-800": "#27272a",
  "--neutral-900": "#18181b",
  "--neutral-950": "#0a0a0a",
  "--background": "#fafafa",
  "--surface": "#ffffff",
  "--surface-elevated": "#ffffff",
  "--surface-overlay": "#ffffff",
  "--surface-sidebar": "#f4f4f5",
  "--surface-navbar": "#ffffff",
  "--surface-card": "#ffffff",
  "--surface-hover": "#f4f4f5",
  "--surface-selected": "#eff6ff",
  "--surface-active": "#dbeafe",
  "--surface-disabled": "#f4f4f5",
  "--text-primary": "#0a0a0a",
  "--text-secondary": "#52525b",
  "--text-muted": "#71717a",
  "--text-disabled": "#a1a1aa",
  "--text-inverse": "#ffffff",
  "--text-link": "#2563eb",
  "--text-heading": "#0a0a0a",
  "--text-caption": "#71717a",
  "--success": "#059669",
  "--warning": "#d97706",
  "--error": "#dc2626",
  "--info": "#2563eb",
  "--positive-financial": "#059669",
  "--negative-financial": "#dc2626",
  "--neutral-financial": "#71717a",
  "--pending": "#71717a",
  "--processing": "#d946ef",
  "--completed": "#059669",
  "--archived": "#a1a1aa",
  "--chart-revenue": "#2563eb",
  "--chart-expenses": "#0d9488",
  "--chart-profit": "#059669",
  "--chart-loss": "#dc2626",
  "--chart-assets": "#2563eb",
  "--chart-liabilities": "#d97706",
  "--chart-forecast": "#d946ef",
  "--chart-trend": "#2563eb",
  "--chart-benchmark": "#a1a1aa",
  "--chart-comparison": "#0d9488",
  "--chart-risk": "#dc2626",
  "--chart-opportunity": "#059669",
}

const sections: { title: string; items: Swatch[] }[] = [
  {
    title: "Brand Colors",
    items: [
      { token: "--primary", hex: cssVarMap["--primary"], description: "Primary brand color. CTAs, active navigation, key metrics, links." },
      { token: "--secondary", hex: cssVarMap["--secondary"], description: "Secondary brand color. Comparative data, supporting metrics, secondary CTAs." },
      { token: "--accent", hex: cssVarMap["--accent"], description: "Brand accent. AI-generated content, marketing CTAs, brand mark highlight." },
      { token: "--finance-accent", hex: cssVarMap["--finance-accent"], description: "Finance accent. Positive financial values, gains, success states." },
      { token: "--ai-accent", hex: cssVarMap["--ai-accent"], description: "AI accent. Active inference, computation states, processing indicators." },
    ],
  },
  {
    title: "Neutral Scale",
    items: [
      { token: "--neutral-50", hex: cssVarMap["--neutral-50"], description: "Page backgrounds, elevated surfaces (light)." },
      { token: "--neutral-100", hex: cssVarMap["--neutral-100"], description: "Secondary backgrounds, hover rows (light)." },
      { token: "--neutral-200", hex: cssVarMap["--neutral-200"], description: "Borders, dividers, disabled states (light)." },
      { token: "--neutral-300", hex: cssVarMap["--neutral-300"], description: "Subtle UI elements, inactive borders (light)." },
      { token: "--neutral-400", hex: cssVarMap["--neutral-400"], description: "Placeholder text, disabled text, benchmark gray." },
      { token: "--neutral-500", hex: cssVarMap["--neutral-500"], description: "Secondary text, captions." },
      { token: "--neutral-600", hex: cssVarMap["--neutral-600"], description: "Tertiary text, subtle labels (light only)." },
      { token: "--neutral-700", hex: cssVarMap["--neutral-700"], description: "Dark mode borders, elevated surface borders." },
      { token: "--neutral-800", hex: cssVarMap["--neutral-800"], description: "Body text (dark theme), borders (light)." },
      { token: "--neutral-900", hex: cssVarMap["--neutral-900"], description: "Dark mode elevated surfaces, dark cards." },
      { token: "--neutral-950", hex: cssVarMap["--neutral-950"], description: "Dark mode primary background (Obsidian)." },
    ],
  },
  {
    title: "Background & Surface Hierarchy",
    items: [
      { token: "--background", hex: cssVarMap["--background"], description: "Page and app background. Deepest layer.", isSurface: true },
      { token: "--surface", hex: cssVarMap["--surface"], description: "Default card, panel, section background.", isSurface: true },
      { token: "--surface-elevated", hex: cssVarMap["--surface-elevated"], description: "Dropdowns, menus, tooltips, floating panels.", isSurface: true },
      { token: "--surface-overlay", hex: cssVarMap["--surface-overlay"], description: "Modals, sheets, dialogs, full-screen overlays.", isSurface: true },
      { token: "--surface-sidebar", hex: cssVarMap["--surface-sidebar"], description: "Persistent side navigation (anchored left edge).", isSurface: true },
      { token: "--surface-navbar", hex: cssVarMap["--surface-navbar"], description: "Top navigation bar.", isSurface: true },
      { token: "--surface-card", hex: cssVarMap["--surface-card"], description: "Card containers (identical to surface; differentiated by border).", isSurface: true },
      { token: "--surface-hover", hex: cssVarMap["--surface-hover"], description: "Hover state on clickable rows, list items, table cells.", isSurface: true },
      { token: "--surface-selected", hex: cssVarMap["--surface-selected"], description: "Selected state (light: blue tint, dark: deep blue tint).", isSurface: true },
      { token: "--surface-active", hex: cssVarMap["--surface-active"], description: "Active / pressed state (deeper than selected).", isSurface: true },
      { token: "--surface-disabled", hex: cssVarMap["--surface-disabled"], description: "Disabled elements (background shift, not opacity).", isSurface: true },
    ],
  },
  {
    title: "Text Hierarchy",
    items: [
      { token: "--text-primary", hex: cssVarMap["--text-primary"], description: "Primary body text, headings, important labels.", isText: true },
      { token: "--text-secondary", hex: cssVarMap["--text-secondary"], description: "Secondary text, descriptions, supporting info.", isText: true },
      { token: "--text-muted", hex: cssVarMap["--text-muted"], description: "Tertiary text, captions, helper text.", isText: true },
      { token: "--text-disabled", hex: cssVarMap["--text-disabled"], description: "Disabled text, inactive states.", isText: true },
      { token: "--text-inverse", hex: cssVarMap["--text-inverse"], description: "Text on primary-colored backgrounds.", isText: true },
      { token: "--text-link", hex: cssVarMap["--text-link"], description: "Hyperlinks, clickable references.", isText: true },
      { token: "--text-heading", hex: cssVarMap["--text-heading"], description: "Headings H1–H6.", isText: true },
      { token: "--text-caption", hex: cssVarMap["--text-caption"], description: "Captions, timestamps, metadata.", isText: true },
    ],
  },
  {
    title: "Semantic Colors",
    items: [
      { token: "--success", hex: cssVarMap["--success"], description: "Success states, completed workflows, approved actions." },
      { token: "--warning", hex: cssVarMap["--warning"], description: "Warnings, alerts, moderated states, data anomalies." },
      { token: "--error", hex: cssVarMap["--error"], description: "Errors, losses, negative returns, critical alerts." },
      { token: "--info", hex: cssVarMap["--info"], description: "Info states, help, contextual hints (sparingly)." },
      { token: "--positive-financial", hex: cssVarMap["--positive-financial"], description: "Financial gains, revenue growth, EBITDA expansion." },
      { token: "--negative-financial", hex: cssVarMap["--negative-financial"], description: "Financial losses, margin compression, sell recommendations." },
      { token: "--neutral-financial", hex: cssVarMap["--neutral-financial"], description: "Flat performance, hold recommendations, unchanged metrics." },
      { token: "--pending", hex: cssVarMap["--pending"], description: "Queued workflows, awaiting input, scheduled tasks." },
      { token: "--processing", hex: cssVarMap["--processing"], description: "Active AI inference, running computations, loading states." },
      { token: "--completed", hex: cssVarMap["--completed"], description: "Finished workflows, successful submissions, done states." },
      { token: "--archived", hex: cssVarMap["--archived"], description: "Stored results, historical archives, inactive records." },
    ],
  },
  {
    title: "Financial Colors",
    items: [
      { token: "--chart-revenue", hex: cssVarMap["--chart-revenue"], description: "Revenue, Sales, Top-line." },
      { token: "--chart-expenses", hex: cssVarMap["--chart-expenses"], description: "Expenses, OpEx, Costs." },
      { token: "--chart-profit", hex: cssVarMap["--chart-profit"], description: "Net Income, EBITDA, Margin." },
      { token: "--chart-loss", hex: cssVarMap["--chart-loss"], description: "Losses, Net Loss, Deficit." },
      { token: "--chart-assets", hex: cssVarMap["--chart-assets"], description: "Total Assets, Current Assets." },
      { token: "--chart-liabilities", hex: cssVarMap["--chart-liabilities"], description: "Total Liabilities, Debt." },
      { token: "--chart-forecast", hex: cssVarMap["--chart-forecast"], description: "Projected values, AI forecasts, model outputs." },
      { token: "--chart-trend", hex: cssVarMap["--chart-trend"], description: "Trend lines, moving averages, regression." },
      { token: "--chart-benchmark", hex: cssVarMap["--chart-benchmark"], description: "Index comparison, benchmark index, prior period." },
      { token: "--chart-comparison", hex: cssVarMap["--chart-comparison"], description: "Peer comparison, sector median, comparable." },
      { token: "--chart-risk", hex: cssVarMap["--chart-risk"], description: "Risk exposure, volatility, credit risk." },
      { token: "--chart-opportunity", hex: cssVarMap["--chart-opportunity"], description: "Investment opportunity, growth potential, upside." },
    ],
  },
  {
    title: "Financial Chart Palette",
    items: [
      { token: "--chart-revenue", hex: cssVarMap["--chart-revenue"], description: "Primary series — Revenue blue." },
      { token: "--chart-expenses", hex: cssVarMap["--chart-expenses"], description: "Secondary series — Expenses teal." },
      { token: "--chart-profit", hex: cssVarMap["--chart-profit"], description: "Outcome series — Profit emerald." },
      { token: "--chart-loss", hex: cssVarMap["--chart-loss"], description: "Negative series — Loss crimson." },
      { token: "--chart-assets", hex: cssVarMap["--chart-assets"], description: "Balance sheet — Assets blue." },
      { token: "--chart-liabilities", hex: cssVarMap["--chart-liabilities"], description: "Balance sheet — Liabilities amber." },
      { token: "--chart-forecast", hex: cssVarMap["--chart-forecast"], description: "Generated series — Forecast fuchsia." },
      { token: "--chart-benchmark", hex: cssVarMap["--chart-benchmark"], description: "Reference series — Benchmark gray." },
    ],
  },
]

function Swatch({ token, hex, description, isText, isSurface }: Swatch) {
  const bg = isText ? cssVarMap["--surface"] : undefined
  const textColor = isSurface ? cssVarMap["--text-primary"] : undefined

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      <div
        className="h-20 w-full"
        style={{
          backgroundColor: isSurface || isText ? undefined : hex,
          color: isText ? hex : undefined,
        }}
      >
        {isSurface && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm font-medium" style={{ color: textColor }}>
              Aa
            </span>
          </div>
        )}
        {isText && (
          <div className="flex h-full items-center justify-center" style={{ backgroundColor: bg }}>
            <span className="text-sm font-medium" style={{ color: hex }}>
              The quick brown fox
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <code className="text-xs font-mono text-text-secondary">{token}</code>
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor: hex }}
          />
          <span className="text-xs font-mono uppercase tracking-wide">{hex}</span>
        </div>
        <p className="text-xs text-text-muted leading-snug">{description}</p>
      </div>
    </div>
  )
}

export default function DesignSystemPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-heading tracking-tight">
              Design System QA
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Analytix color and theme foundation — visual inspection
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-surface">
            <button
              onClick={() => setTheme("light")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                theme === "light"
                  ? "bg-background text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                theme === "dark"
                  ? "bg-background text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10 space-y-12">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
              {section.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {section.items.map((item) => (
                <Swatch key={item.token} {...item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 border-t border-border mt-12">
        <p className="text-xs text-text-muted">
          Source of truth: docs/brand-colors.md, semantic-colors.md, theme-system.md, financial-chart-colors.md
        </p>
      </div>
    </div>
  )
}
