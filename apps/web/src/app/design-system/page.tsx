"use client"

import { useState, useEffect } from "react"

interface Swatch {
  token: string
  hex: string
  description: string
  isText?: boolean
  isSurface?: boolean
}

interface TypographySample {
  name: string
  example: string
  fontFamily: string
  size: string
  weight: string
  lineHeight: string
  letterSpacing: string
  className: string
  mono?: boolean
  tabular?: boolean
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

const typographySamples: TypographySample[] = [
  {
    name: "Display",
    example: "Financial Intelligence, Simplified",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "48px",
    weight: "700",
    lineHeight: "1.05",
    letterSpacing: "-0.02em",
    className: "text-display",
  },
  {
    name: "H1",
    example: "Reliance Industries",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "36px",
    weight: "600",
    lineHeight: "1.2",
    letterSpacing: "0",
    className: "text-h1",
  },
  {
    name: "H2",
    example: "Operating Margin Analysis",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "28px",
    weight: "600",
    lineHeight: "1.25",
    letterSpacing: "0",
    className: "text-h2",
  },
  {
    name: "H3",
    example: "DCF Valuation Model",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "22px",
    weight: "600",
    lineHeight: "1.3",
    letterSpacing: "0",
    className: "text-h3",
  },
  {
    name: "H4",
    example: "Sensitivity Analysis",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "18px",
    weight: "600",
    lineHeight: "1.4",
    letterSpacing: "0",
    className: "text-h4",
  },
  {
    name: "Body Large",
    example: "Revenue increased 12.4% year-over-year, driven by strong performance in the digital services segment and expanded market reach across emerging markets.",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "18px",
    weight: "400",
    lineHeight: "1.6",
    letterSpacing: "0",
    className: "text-body-lg",
  },
  {
    name: "Body",
    example: "The company reported a net income of ₹24,382.57 crore for the fiscal year ended March 31, 2026. Operating margins expanded 240 basis points year-over-year.",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "16px",
    weight: "400",
    lineHeight: "1.6",
    letterSpacing: "0",
    className: "text-body",
  },
  {
    name: "Body Small",
    example: "Data sourced from company filings and analyst estimates. Past performance does not guarantee future results.",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "14px",
    weight: "400",
    lineHeight: "1.5",
    letterSpacing: "0.01em",
    className: "text-body-sm",
  },
  {
    name: "Label",
    example: "COMPANY",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "13px",
    weight: "500",
    lineHeight: "1.5",
    letterSpacing: "0.02em",
    className: "text-label",
  },
  {
    name: "Caption",
    example: "Last updated 2 hours ago",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "12px",
    weight: "500",
    lineHeight: "1.5",
    letterSpacing: "0.03em",
    className: "text-caption",
  },
  {
    name: "Button",
    example: "Run Analysis",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "14px",
    weight: "500",
    lineHeight: "1.5",
    letterSpacing: "0.02em",
    className: "text-button",
  },
  {
    name: "Table",
    example: "Company | Revenue | Margin | Growth",
    fontFamily: "Geist Sans / Instrument Sans",
    size: "13px",
    weight: "400",
    lineHeight: "1.6",
    letterSpacing: "0",
    className: "text-table",
  },
  {
    name: "Numeric Data",
    example: "₹24,382.57  |  +12.48%  |  -3.21%  |  ₹1.24T  |  18.75%  |  FY 2026",
    fontFamily: "Geist Mono / JetBrains Mono",
    size: "14px",
    weight: "500",
    lineHeight: "1.5",
    letterSpacing: "0",
    className: "text-numeric tabular-nums",
    mono: true,
    tabular: true,
  },
  {
    name: "Code / Monospace",
    example: "const dcf = new DCFModel({ WACC: 0.0925, terminalGrowth: 0.025 });",
    fontFamily: "Geist Mono / JetBrains Mono",
    size: "13px",
    weight: "400",
    lineHeight: "1.5",
    letterSpacing: "0",
    className: "text-code font-mono",
    mono: true,
  },
]

const spacingTokens = [
  { name: "space-1", value: "4px", rem: "0.25rem" },
  { name: "space-2", value: "8px", rem: "0.5rem" },
  { name: "space-3", value: "12px", rem: "0.75rem" },
  { name: "space-4", value: "16px", rem: "1rem" },
  { name: "space-5", value: "20px", rem: "1.25rem" },
  { name: "space-6", value: "24px", rem: "1.5rem" },
  { name: "space-8", value: "32px", rem: "2rem" },
  { name: "space-10", value: "40px", rem: "2.5rem" },
  { name: "space-12", value: "48px", rem: "3rem" },
  { name: "space-16", value: "64px", rem: "4rem" },
  { name: "space-20", value: "80px", rem: "5rem" },
  { name: "space-24", value: "96px", rem: "6rem" },
]

const radiusTokens = [
  { name: "none", value: "0px" },
  { name: "xs", value: "2px" },
  { name: "sm", value: "4px" },
  { name: "md", value: "6px" },
  { name: "lg", value: "8px" },
  { name: "xl", value: "12px" },
  { name: "2xl", value: "16px" },
  { name: "full", value: "9999px" },
]

const borderTokens = [
  { name: "default", width: "1px", color: "var(--border-default)" },
  { name: "subtle", width: "1px", color: "var(--border-subtle)" },
  { name: "strong", width: "2px", color: "var(--border-strong)" },
  { name: "focus", width: "2px", color: "var(--primary)", offset: "2px" },
]

const elevationTokens = [
  { name: "xs", value: "var(--shadow-xs)" },
  { name: "sm", value: "var(--shadow-sm)" },
  { name: "md", value: "var(--shadow-md)" },
  { name: "lg", value: "var(--shadow-lg)" },
  { name: "xl", value: "var(--shadow-xl)" },
  { name: "dropdown", value: "var(--shadow-dropdown)" },
  { name: "popover", value: "var(--shadow-popover)" },
  { name: "dialog", value: "var(--shadow-dialog)" },
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

function TypographySample({ sample }: { sample: TypographySample }) {
  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      <div className="p-4 bg-surface">
        <div className={`${sample.className} text-text-primary break-words`}>
          {sample.example}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <code className="text-xs font-mono text-text-secondary">{sample.name}</code>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
          <div className="text-xs text-text-muted">Family</div>
          <div className="text-xs text-text-secondary text-right">{sample.fontFamily}</div>
          <div className="text-xs text-text-muted">Size</div>
          <div className="text-xs text-text-secondary text-right">{sample.size}</div>
          <div className="text-xs text-text-muted">Weight</div>
          <div className="text-xs text-text-secondary text-right">{sample.weight}</div>
          <div className="text-xs text-text-muted">Line Height</div>
          <div className="text-xs text-text-secondary text-right">{sample.lineHeight}</div>
          <div className="text-xs text-text-muted">Tracking</div>
          <div className="text-xs text-text-secondary text-right">{sample.letterSpacing}</div>
        </div>
        {sample.mono && (
          <div className="mt-2 pt-2 border-t border-border">
            <span className="text-xs font-mono text-positive-financial tabular-nums">
              {sample.example}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function LayoutSection() {
  return (
    <div className="space-y-8">
      {/* Spacing */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Spacing</h3>
        <div className="flex flex-wrap items-end gap-4">
          {spacingTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div className="bg-primary/10 border border-primary/20 rounded" style={{ width: token.value, height: token.value }} />
              <div className="text-center">
                <div className="text-xs font-mono text-text-secondary">{token.name}</div>
                <div className="text-xs text-text-muted">{token.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Radius */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Border Radius</h3>
        <div className="flex flex-wrap items-center gap-4">
          {radiusTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div className="bg-primary/10 border border-primary/20" style={{ borderRadius: token.value, width: 48, height: 48 }} />
              <div className="text-center">
                <div className="text-xs font-mono text-text-secondary">{token.name}</div>
                <div className="text-xs text-text-muted">{token.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Borders */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Borders</h3>
        <div className="flex flex-wrap items-center gap-4">
          {borderTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div
                className="bg-surface"
                style={{
                  borderWidth: token.width,
                  borderStyle: "solid",
                  borderColor: token.color,
                  outline: token.name === "focus" ? `${token.width} solid ${token.color}` : "none",
                  outlineOffset: token.offset || "0",
                  width: 64,
                  height: 48,
                }}
              />
              <div className="text-center">
                <div className="text-xs font-mono text-text-secondary">{token.name}</div>
                <div className="text-xs text-text-muted">{token.width}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Elevation */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Elevation / Shadows</h3>
        <div className="flex flex-wrap items-center gap-4">
          {elevationTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div
                className="bg-surface border border-border"
                style={{ boxShadow: token.value, width: 80, height: 48 }}
              />
              <div className="text-center">
                <div className="text-xs font-mono text-text-secondary">{token.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Focus Ring */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Focus Ring (Keyboard)</h3>
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium"
            style={{ outline: "var(--focus-ring-width) solid var(--focus-ring-color)", outlineOffset: "var(--focus-ring-offset)", borderRadius: "var(--focus-ring-radius)" }}
          >
            Focused Element
          </button>
          <div className="text-xs text-text-muted">
            Press Tab to see focus ring on interactive elements
          </div>
        </div>
      </div>

      {/* Layout */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Layout Containers</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-32 text-xs font-mono text-text-secondary">content</div>
            <div className="h-12 bg-primary/10 border border-dashed border-primary/30 rounded flex items-center justify-center" style={{ maxWidth: "var(--container-content)", width: "100%" }}>
              <span className="text-xs text-text-muted">1280px</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-xs font-mono text-text-secondary">dashboard</div>
            <div className="h-12 bg-primary/10 border border-dashed border-primary/30 rounded flex items-center justify-center" style={{ maxWidth: "var(--container-dashboard)", width: "100%" }}>
              <span className="text-xs text-text-muted">1440px</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-xs font-mono text-text-secondary">reading</div>
            <div className="h-12 bg-primary/10 border border-dashed border-primary/30 rounded flex items-center justify-center" style={{ maxWidth: "var(--container-reading)", width: "100%" }}>
              <span className="text-xs text-text-muted">768px</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-xs font-mono text-text-secondary">page padding</div>
            <div className="h-12 bg-surface border border-border rounded flex items-center justify-center" style={{ paddingLeft: "var(--page-padding)", paddingRight: "var(--page-padding)" }}>
              <span className="text-xs text-text-muted">24px</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-xs font-mono text-text-secondary">section gap</div>
            <div className="h-12 bg-surface border border-border rounded flex items-center justify-center" style={{ gap: "var(--section-gap)" }}>
              <div className="w-8 h-8 bg-primary/10 rounded" />
              <div className="w-8 h-8 bg-primary/10 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-xs font-mono text-text-secondary">card gap</div>
            <div className="h-12 bg-surface border border-border rounded flex items-center justify-center" style={{ gap: "var(--card-gap)" }}>
              <div className="w-8 h-8 bg-primary/10 rounded" />
              <div className="w-8 h-8 bg-primary/10 rounded" />
            </div>
          </div>
        </div>
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

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Typography
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {typographySamples.map((sample) => (
              <TypographySample key={sample.name} sample={sample} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Layout & Foundations
          </h2>
          <LayoutSection />
        </section>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 border-t border-border mt-12">
        <p className="text-xs text-text-muted">
          Source of truth: docs/brand-colors.md, semantic-colors.md, theme-system.md, financial-chart-colors.md, brand-identity.md
        </p>
      </div>
    </div>
  )
}
