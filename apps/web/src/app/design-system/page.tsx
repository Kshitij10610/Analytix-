"use client"

import { useState, useEffect } from "react"
import { Button, IconButton, Badge, Input, Textarea, Select, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, TrendIndicator, FinancialMetric, MetricCard, DataTable, CurrencyCell, PercentageCell, TrendCell, StatusCell } from "@/components/primitives"

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

interface CompanyRow {
  company: string
  revenue: string
  revenueValue: number
  netIncome: string
  netIncomeValue: number
  margin: string
  marginValue: number
  revenueGrowth: string
  revenueGrowthValue: number
  growthStatus: "positive" | "negative" | "neutral"
  status: string
  statusVariant: "neutral" | "primary" | "success" | "warning" | "error" | "info" | "positive" | "negative"
}

const companyRows: CompanyRow[] = [
  {
    company: "Reliance Industries",
    revenue: "₹9.6T",
    revenueValue: 9.6,
    netIncome: "₹790B",
    netIncomeValue: 790,
    margin: "8.2%",
    marginValue: 8.2,
    revenueGrowth: "+12.4%",
    revenueGrowthValue: 12.4,
    growthStatus: "positive",
    status: "Completed",
    statusVariant: "success",
  },
  {
    company: "TCS",
    revenue: "₹2.4T",
    revenueValue: 2.4,
    netIncome: "₹460B",
    netIncomeValue: 460,
    margin: "19.1%",
    marginValue: 19.1,
    revenueGrowth: "+8.3%",
    revenueGrowthValue: 8.3,
    growthStatus: "positive",
    status: "Completed",
    statusVariant: "success",
  },
  {
    company: "Infosys",
    revenue: "₹1.5T",
    revenueValue: 1.5,
    netIncome: "₹260B",
    netIncomeValue: 260,
    margin: "17.3%",
    marginValue: 17.3,
    revenueGrowth: "-3.2%",
    revenueGrowthValue: -3.2,
    growthStatus: "negative",
    status: "Pending",
    statusVariant: "warning",
  },
  {
    company: "HDFC Bank",
    revenue: "₹3.1T",
    revenueValue: 3.1,
    netIncome: "₹640B",
    netIncomeValue: 640,
    margin: "20.6%",
    marginValue: 20.6,
    revenueGrowth: "+10.1%",
    revenueGrowthValue: 10.1,
    growthStatus: "positive",
    status: "Processing",
    statusVariant: "info",
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
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${theme === "light"
                ? "bg-background text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
                }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${theme === "dark"
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
            Cards
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Variants</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card variant="default" padding="md">
                  <CardHeader>
                    <CardTitle>Revenue Analysis</CardTitle>
                    <CardDescription>FY 2026 financial overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                  <CardFooter>
                    <p className="text-caption text-text-muted">Updated recently</p>
                  </CardFooter>
                </Card>
                <Card variant="elevated" padding="md">
                  <CardHeader>
                    <CardTitle>Revenue Analysis</CardTitle>
                    <CardDescription>FY 2026 financial overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                  <CardFooter>
                    <p className="text-caption text-text-muted">Updated recently</p>
                  </CardFooter>
                </Card>
                <Card variant="outlined" padding="md">
                  <CardHeader>
                    <CardTitle>Revenue Analysis</CardTitle>
                    <CardDescription>FY 2026 financial overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                  <CardFooter>
                    <p className="text-caption text-text-muted">Updated recently</p>
                  </CardFooter>
                </Card>
                <Card variant="interactive" padding="md" tabIndex={0} role="button" aria-label="View revenue analysis">
                  <CardHeader>
                    <CardTitle>Revenue Analysis</CardTitle>
                    <CardDescription>FY 2026 financial overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                  <CardFooter>
                    <p className="text-caption text-text-muted">Updated recently</p>
                  </CardFooter>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold textText-secondary mb-4 uppercase tracking-wider">Padding</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="default" padding="none">
                  <CardHeader>
                    <CardTitle>No Padding</CardTitle>
                    <CardDescription>Content flush to edges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                </Card>
                <Card variant="default" padding="sm">
                  <CardHeader>
                    <CardTitle>Small Padding</CardTitle>
                    <CardDescription>Compact spacing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                </Card>
                <Card variant="default" padding="md">
                  <CardHeader>
                    <CardTitle>Medium Padding</CardTitle>
                    <CardDescription>Default spacing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                </Card>
                <Card variant="default" padding="lg">
                  <CardHeader>
                    <CardTitle>Large Padding</CardTitle>
                    <CardDescription>Generous spacing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Revenue ₹1.24T</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Accessibility & Responsive QA</h3>
              <p className="text-xs text-text-muted mb-4">Normal cards are presentational divs. Interactive cards support keyboard focus via Tab and visible focus-visible outline. Resize viewport to verify at 375px mobile, 768px tablet, and desktop. No fixed widths.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="default" padding="md">
                  <CardHeader>
                    <CardTitle>Light Theme</CardTitle>
                    <CardDescription>Default light rendering</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Use theme switcher to confirm both themes.</p>
                  </CardContent>
                </Card>
                <Card variant="default" padding="md" className="bg-surface-card dark:bg-surface-card">
                  <CardHeader>
                    <CardTitle>Dark Theme</CardTitle>
                    <CardDescription>Dark mode rendering</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-body text-text-primary">Cards inherit theme tokens automatically.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Trend Indicator
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Semantic Status</h3>
              <p className="text-xs text-text-muted mb-4">Status is caller-controlled, not inferred from numeric sign.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <TrendIndicator value="+12.4%" status="positive" />
                <TrendIndicator value="-3.2%" status="negative" />
                <TrendIndicator value="0.0%" status="neutral" />
                <TrendIndicator value="+240 bps" status="positive" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Caller-Controlled Semantics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-text-muted mb-2">Revenue Growth +8.5% → status=positive</p>
                  <TrendIndicator value="+8.5%" status="positive" accessibleLabel="Revenue growth positive" />
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2">Expense Growth +8.5% → status=negative</p>
                  <TrendIndicator value="+8.5%" status="negative" accessibleLabel="Expense growth negative" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Financial Metric
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Examples</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FinancialMetric
                  label="Revenue"
                  value="₹1.24T"
                  change="+12.4%"
                  trendStatus="positive"
                  comparisonText="vs FY 2025"
                />
                <FinancialMetric
                  label="Operating Margin"
                  value="18.75%"
                  change="+240 bps"
                  trendStatus="positive"
                  comparisonText="YoY"
                  helperText="Year over year improvement"
                />
                <FinancialMetric
                  label="Net Income"
                  value="₹24,382.57 Cr"
                  change="+8.3%"
                  trendStatus="positive"
                  comparisonText="YoY"
                />
                <FinancialMetric
                  label="Free Cash Flow"
                  value="₹8,420 Cr"
                  change="-3.2%"
                  trendStatus="negative"
                  comparisonText="vs FY 2025"
                />
                <FinancialMetric
                  label="Expense Growth"
                  value="+8.5%"
                  change="+8.5%"
                  trendStatus="negative"
                  statusContext="Negative semantic status despite positive numeric sign"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Metric Cards
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Examples</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  label="Revenue"
                  primaryValue="₹1.24T"
                  trend="+12.4%"
                  trendStatus="positive"
                  comparisonPeriod="vs FY 2025"
                />
                <MetricCard
                  label="Net Income"
                  primaryValue="₹24,382.57 Cr"
                  trend="+8.3%"
                  trendStatus="positive"
                  comparisonPeriod="YoY"
                />
                <MetricCard
                  label="Operating Margin"
                  primaryValue="18.75%"
                  trend="+240 bps"
                  trendStatus="positive"
                  comparisonPeriod="YoY"
                />
                <MetricCard
                  label="Operating Expenses"
                  primaryValue="₹42,680 Cr"
                  trend="+8.5%"
                  trendStatus="negative"
                  comparisonPeriod="vs FY 2025"
                />
                <MetricCard
                  label="Free Cash Flow"
                  primaryValue="₹8,420 Cr"
                  trend="-3.2%"
                  trendStatus="negative"
                  comparisonPeriod="YoY"
                />
                <MetricCard
                  label="Debt-to-Equity"
                  primaryValue="0.42x"
                  trend="0.0%"
                  trendStatus="neutral"
                  comparisonPeriod="Current Period"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Semantic Status</h3>
              <p className="text-xs text-text-muted mb-4">MetricCard does not infer financial meaning from numeric sign. Caller explicitly provides status.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MetricCard
                  label="Revenue Growth"
                  primaryValue="+8.5%"
                  trend="+8.5%"
                  trendStatus="positive"
                  comparisonPeriod="YoY"
                />
                <MetricCard
                  label="Expense Growth"
                  primaryValue="+8.5%"
                  trend="+8.5%"
                  trendStatus="negative"
                  comparisonPeriod="YoY"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Loading State</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard label="Revenue" primaryValue="₹1.24T" loading />
                <MetricCard label="Net Income" primaryValue="₹24,382.57 Cr" loading />
                <MetricCard label="Operating Margin" primaryValue="18.75%" loading />
                <MetricCard label="Free Cash Flow" primaryValue="₹8,420 Cr" loading />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Responsive KPI Grid</h3>
              <p className="text-xs text-text-muted mb-4">Resize viewport to verify 1 column mobile, 2 columns tablet, 4 columns desktop. No horizontal overflow. Cards use available width.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  label="Revenue"
                  primaryValue="₹1.24T"
                  trend="+12.4%"
                  trendStatus="positive"
                  comparisonPeriod="vs FY 2025"
                />
                <MetricCard
                  label="Net Income"
                  primaryValue="₹24,382.57 Cr"
                  trend="+8.3%"
                  trendStatus="positive"
                  comparisonPeriod="YoY"
                />
                <MetricCard
                  label="Operating Margin"
                  primaryValue="18.75%"
                  trend="+240 bps"
                  trendStatus="positive"
                  comparisonPeriod="YoY"
                />
                <MetricCard
                  label="Free Cash Flow"
                  primaryValue="₹8,420 Cr"
                  trend="-3.2%"
                  trendStatus="negative"
                  comparisonPeriod="vs FY 2025"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Themes</h3>
              <p className="text-xs text-text-muted mb-4">MetricCards render in both Light and Dark themes using existing tokens.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MetricCard
                  label="Revenue"
                  primaryValue="₹1.24T"
                  trend="+12.4%"
                  trendStatus="positive"
                  comparisonPeriod="vs FY 2025"
                />
                <MetricCard
                  label="Operating Expenses"
                  primaryValue="₹42,680 Cr"
                  trend="+8.5%"
                  trendStatus="negative"
                  comparisonPeriod="vs FY 2025"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Data Table
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Financial Data</h3>
              <p className="text-xs text-text-muted mb-4">Sample QA data. Tap sortable headers on mobile or use keyboard focus + Enter.</p>
              <DataTable
                columns={[
                  { id: "company", header: "Company", align: "left" },
                  {
                    id: "revenue",
                    header: "Revenue",
                    align: "right",
                    numeric: true,
                    sortable: true,
                    sortCompare: (a: CompanyRow, b: CompanyRow) => a.revenueValue - b.revenueValue,
                    render: (row) => <CurrencyCell value={row.revenue} />,
                  },
                  {
                    id: "netIncome",
                    header: "Net Income",
                    align: "right",
                    numeric: true,
                    sortable: true,
                    sortCompare: (a: CompanyRow, b: CompanyRow) => a.netIncomeValue - b.netIncomeValue,
                    render: (row) => <CurrencyCell value={row.netIncome} />,
                  },
                  {
                    id: "margin",
                    header: "Margin",
                    align: "right",
                    numeric: true,
                    render: (row) => <PercentageCell value={row.margin} />,
                  },
                  {
                    id: "revenueGrowth",
                    header: "Revenue Growth",
                    align: "right",
                    numeric: true,
                    sortable: true,
                    sortCompare: (a: CompanyRow, b: CompanyRow) => a.revenueGrowthValue - b.revenueGrowthValue,
                    render: (row) => <TrendCell value={row.revenueGrowth} status={row.growthStatus} />,
                  },
                  {
                    id: "status",
                    header: "Status",
                    align: "center",
                    render: (row) => <StatusCell status={row.status} variant={row.statusVariant} />,
                  },
                ]}
                rows={companyRows}
                caption="Company financial overview"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Empty State</h3>
              <DataTable
                columns={[
                  { id: "company", header: "Company", align: "left" },
                  { id: "revenue", header: "Revenue", align: "right", numeric: true },
                  { id: "status", header: "Status", align: "center" },
                ]}
                rows={[]}
                caption="No data example"
                emptyState="No company data available."
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Responsive & Themes</h3>
              <p className="text-xs text-text-muted mb-2">Resize viewport to verify behavior at 375px mobile, 768px tablet, and desktop. The table scrolls horizontally inside its container without page-level overflow. Sortable headers remain touch usable.</p>
              <p className="text-xs text-text-muted">Use the theme switcher to verify Light and Dark rendering. Values use existing tokens; no hardcoded colors are introduced.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Select
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Real-World Examples</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Reporting Period"
                  placeholder="Select reporting period"
                  options={[
                    { value: "q1-2026", label: "Q1 2026" },
                    { value: "q4-2025", label: "Q4 2025" },
                    { value: "fy-2025", label: "FY 2025" },
                    { value: "fy-2024", label: "FY 2024" },
                  ]}
                  helperText="Choose the fiscal period for analysis"
                />
                <Select
                  label="Currency"
                  placeholder="Select currency"
                  options={[
                    { value: "inr", label: "INR - Indian Rupee" },
                    { value: "usd", label: "USD - US Dollar" },
                    { value: "eur", label: "EUR - Euro" },
                    { value: "gbp", label: "GBP - British Pound" },
                  ]}
                  helperText="Currency for financial metrics"
                />
                <Select
                  label="Industry"
                  placeholder="Select industry"
                  options={[
                    { value: "it", label: "Information Technology" },
                    { value: "pharma", label: "Pharmaceuticals" },
                    { value: "banking", label: "Banking & Financial Services" },
                    { value: "energy", label: "Energy & Power" },
                    { value: "auto", label: "Automobile" },
                  ]}
                />
                <Select
                  label="Analysis Type"
                  placeholder="Select analysis type"
                  options={[
                    { value: "dcf", label: "DCF Valuation" },
                    { value: "comparable", label: "Comparable Company Analysis" },
                    { value: "precedent", label: "Precedent Transactions" },
                    { value: "lbo", label: "Leveraged Buyout" },
                  ]}
                />
                <Select
                  label="Export Format"
                  placeholder="Select export format"
                  options={[
                    { value: "pdf", label: "PDF Document" },
                    { value: "xlsx", label: "Excel Spreadsheet" },
                    { value: "pptx", label: "PowerPoint Presentation" },
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Sizes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Select
                  size="sm"
                  label="Small"
                  placeholder="Select option"
                  options={[
                    { value: "1", label: "Option 1" },
                    { value: "2", label: "Option 2" },
                  ]}
                  helperText="sm size"
                />
                <Select
                  size="md"
                  label="Medium"
                  placeholder="Select option"
                  options={[
                    { value: "1", label: "Option 1" },
                    { value: "2", label: "Option 2" },
                  ]}
                  helperText="md size"
                />
                <Select
                  size="lg"
                  label="Large"
                  placeholder="Select option"
                  options={[
                    { value: "1", label: "Option 1" },
                    { value: "2", label: "Option 2" },
                  ]}
                  helperText="lg size"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">States</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Default"
                  placeholder="Select an option"
                  options={[
                    { value: "1", label: "Option 1" },
                    { value: "2", label: "Option 2" },
                  ]}
                  helperText="This is helper text"
                />
                <Select
                  label="Required"
                  placeholder="Select an option"
                  required
                  options={[
                    { value: "1", label: "Option 1" },
                    { value: "2", label: "Option 2" },
                  ]}
                  helperText="This field is mandatory"
                />
                <Select
                  label="Error"
                  variant="error"
                  placeholder="Select an option"
                  errorMessage="Please select a valid option"
                  required
                  options={[
                    { value: "1", label: "Option 1" },
                    { value: "2", label: "Option 2" },
                  ]}
                />
                <Select
                  label="Disabled"
                  placeholder="Cannot select"
                  disabled
                  options={[
                    { value: "1", label: "Option 1" },
                  ]}
                  helperText="This field is disabled"
                />
                <Select
                  label="Disabled Option"
                  placeholder="Select an option"
                  options={[
                    { value: "active", label: "Active Plan" },
                    { value: "archived", label: "Archived Plan", disabled: true },
                    { value: "draft", label: "Draft Plan" },
                  ]}
                  helperText="Archived option is not selectable"
                />
                <Select
                  label="Default Value"
                  placeholder="Select an option"
                  defaultValue="usd"
                  options={[
                    { value: "inr", label: "INR" },
                    { value: "usd", label: "USD" },
                    { value: "eur", label: "EUR" },
                  ]}
                  helperText="Pre-selected default value"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Responsive QA</h3>
              <p className="text-xs text-text-muted mb-4">Resize viewport to verify behavior at ~375px mobile, ~768px tablet, and ~1440px desktop. No horizontal overflow should occur. Native Android/iOS select behavior is preserved.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Reporting Period"
                  placeholder="Select reporting period"
                  options={[
                    { value: "q1-2026", label: "Q1 2026" },
                    { value: "q4-2025", label: "Q4 2025" },
                    { value: "fy-2025", label: "FY 2025" },
                    { value: "fy-2024", label: "FY 2024" },
                  ]}
                  helperText="Native select behavior on all devices"
                />
                <Select
                  label="Currency"
                  placeholder="Select currency"
                  size="lg"
                  options={[
                    { value: "inr", label: "INR - Indian Rupee" },
                    { value: "usd", label: "USD - US Dollar" },
                    { value: "eur", label: "EUR - Euro" },
                    { value: "gbp", label: "GBP - British Pound" },
                  ]}
                  helperText="Larger touch target on mobile"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Accessibility QA</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Label & Keyboard</h4>
                  <Select
                    label="Tab to focus"
                    placeholder="Select an option"
                    options={[
                      { value: "1", label: "Option 1" },
                      { value: "2", label: "Option 2" },
                    ]}
                    helperText="Tab to see focus-visible outline"
                  />
                  <p className="text-xs text-text-muted">Label is programmatically associated via htmlFor. Arrow keys navigate options. Enter/Space opens the select. Escape closes it.</p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Error & Helper Association</h4>
                  <Select
                    label="Required Field"
                    placeholder="Select an option"
                    required
                    options={[
                      { value: "1", label: "Option 1" },
                      { value: "2", label: "Option 2" },
                    ]}
                    helperText="aria-required is set"
                  />
                  <Select
                    label="Error Field"
                    variant="error"
                    placeholder="Select an option"
                    errorMessage="This field is required"
                    required
                    options={[
                      { value: "1", label: "Option 1" },
                      { value: "2", label: "Option 2" },
                    ]}
                  />
                  <p className="text-xs text-text-muted">Error text is linked via aria-describedby. Required state uses aria-required.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Theme QA</h3>
              <p className="text-sm text-text-muted mb-4">Select renders correctly in both Light and Dark themes. Use the theme switcher at the top of the page.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Light Theme</h4>
                  <Select
                    label="Industry"
                    placeholder="Select industry"
                    options={[
                      { value: "it", label: "Information Technology" },
                      { value: "pharma", label: "Pharmaceuticals" },
                    ]}
                    helperText="Light theme rendering"
                  />
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Dark Theme</h4>
                  <Select
                    label="Industry"
                    placeholder="Select industry"
                    options={[
                      { value: "it", label: "Information Technology" },
                      { value: "pharma", label: "Pharmaceuticals" },
                    ]}
                    helperText="Dark theme rendering"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Input
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Real-World Examples</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Company" placeholder="Reliance Industries" helperText="Enter the company legal name" />
                <Input label="Analyst Email" type="email" placeholder="analyst@example.com" helperText="Used for report delivery" />
                <Input label="Password" type="password" placeholder="••••••••" helperText="Min 8 characters" />
                <Input label="Revenue Growth" type="number" placeholder="12.4" helperText="Percentage growth year-over-year" />
                <div className="md:col-span-2">
                  <Input type="search" placeholder="Search companies, reports, or filings..." leadingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">States</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Default" placeholder="Enter value" helperText="This is helper text" />
                <Input label="Required" placeholder="Required field" required helperText="This field is mandatory" />
                <Input label="Error" variant="error" placeholder="Enter value" errorMessage="This field is required" required />
                <Input label="Disabled" placeholder="Enter value" disabled helperText="This field is disabled" />
                <Input label="Read Only" placeholder="Reliance Industries" readOnly helperText="Source: company filings" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Sizes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input size="sm" label="Small" placeholder="Small input" helperText="sm size" />
                <Input size="md" label="Medium" placeholder="Medium input" helperText="md size" />
                <Input size="lg" label="Large" placeholder="Large input" helperText="lg size" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Leading & Trailing Elements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input size="sm" label="Leading (sm)" placeholder="Small" leadingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} />
                <Input size="md" label="Trailing (md)" placeholder="Medium" trailingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>} />
                <Input size="lg" label="Leading + Trailing (lg)" placeholder="Large with both" leadingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} trailingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>} />
                <Input type="number" label="Financial" placeholder="0.00" leadingElement={<span className="text-xs font-medium text-text-muted">₹</span>} helperText="Indian Rupee" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Error States with Icons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Invalid Email" type="email" variant="error" placeholder="invalid@" errorMessage="Please enter a valid email address" leadingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} />
                <Input label="Invalid Number" type="number" variant="error" placeholder="-5" errorMessage="Revenue growth cannot be negative" trailingElement={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Textarea
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Variants & States</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Textarea label="Default" placeholder="Enter your analysis..." helperText="Be as detailed as possible" rows={3} />
                <Textarea label="Required" placeholder="Enter your analysis..." required helperText="This field is mandatory" rows={3} />
                <Textarea label="Error" variant="error" placeholder="Enter your analysis..." errorMessage="Analysis is too short" required rows={3} />
                <Textarea label="Disabled" placeholder="Analysis locked" disabled helperText="Contact admin to edit" rows={3} />
                <Textarea label="Read Only" placeholder="Analyze revenue growth, operating margins, cash flow trends, and major risks." readOnly helperText="Locked version" rows={3} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Sizes & Character Count</h3>
              <div className="grid grid-cols-1 gap-6">
                <Textarea size="sm" placeholder="Brief summary (sm)" rows={2} maxCharacterCount={100} characterCount={45} />
                <Textarea size="md" placeholder="Detailed analysis (md)" rows={4} maxCharacterCount={500} characterCount={234} />
                <Textarea size="lg" placeholder="Comprehensive report (lg)" rows={6} maxCharacterCount={1000} characterCount={678} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">Financial Analysis Example</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Textarea label="Analyst Notes" placeholder="Analyze revenue growth, operating margins, cash flow trends, and major risks." helperText="Minimum 100 characters" rows={5} maxCharacterCount={1000} characterCount={142} />
                <Textarea label="Risk Assessment" placeholder="Identify key risks, mitigation strategies, and probability-weighted outcomes." helperText="Focus on material risks" variant="error" errorMessage="Risk assessment is incomplete" rows={5} />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Accessibility QA
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary">Label Association</h3>
                <Input label="Tab to focus" placeholder="Click label to focus" helperText="Label is programmatically associated via htmlFor" />
                <Textarea label="Notes" placeholder="Tab to focus this textarea" helperText="Click label to focus" rows={2} />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-textSecondary">Screen Reader Attributes</h3>
                <Input label="Required Field" placeholder="Required input" required helperText="aria-required is set" />
                <Input label="Error Field" variant="error" placeholder="Invalid input" errorMessage="aria-invalid and aria-describedby are set" required />
                <Textarea label="Accessible Textarea" placeholder="Accessible" helperText="aria-describedby links helper text" rows={2} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary">Disabled & Read-Only</h3>
                <Input label="Disabled" placeholder="Cannot edit" disabled helperText="Semantically disabled" />
                <Input label="Read Only" placeholder="Cannot modify" readOnly helperText="Semantically read-only" />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary">Focus Visible</h3>
                <Input label="Focus me" placeholder="Tab to see focus ring" helperText="focus-visible uses --focus-ring-* tokens" />
                <Textarea label="Focus textarea" placeholder="Tab to see focus ring" helperText="focus-visible uses --focus-ring-* tokens" rows={2} />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-4">
              Keyboard navigation: Tab through elements to verify focus-visible outlines. Screen readers will announce labels, required state, error messages, and helper text via aria-describedby.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Theme QA
          </h2>
          <p className="text-sm text-text-muted mb-6">Input and Textarea components render correctly in both Light and Dark themes. Use the theme switcher at the top of the page to verify.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-secondary">Light Theme Examples</h3>
              <Input label="Company" placeholder="Reliance Industries" helperText="Light theme" />
              <Textarea label="Analysis" placeholder="Type your analysis..." rows={2} helperText="Light theme" />
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-secondary">Dark Theme Examples</h3>
              <Input label="Company" placeholder="Reliance Industries" helperText="Dark theme" />
              <Textarea label="Analysis" placeholder="Type your analysis..." rows={2} helperText="Dark theme" />
            </div>
          </div>
        </section>

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

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Button
          </h2>
          <div className="space-y-6">
            {(["primary", "secondary", "outline", "ghost", "destructive"] as const).map((variant) => (
              <div key={variant}>
                <h3 className="text-sm font-semibold text-text-secondary mb-3 capitalize">{variant}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant={variant} size="sm">Small</Button>
                  <Button variant={variant} size="md">Medium</Button>
                  <Button variant={variant} size="lg">Large</Button>
                  <Button variant={variant} size="md" disabled>Disabled</Button>
                  <Button variant={variant} size="md" loading>Loading</Button>
                  <Button variant={variant} size="md" leadingIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>}>Leading</Button>
                  <Button variant={variant} size="md" trailingIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>}>Trailing</Button>
                  <Button variant={variant} size="md" fullWidth>Full Width</Button>
                </div>
                <div className="mt-2 text-xs text-text-muted">Run Analysis · Generate Report · Export · Compare · Delete Report</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Icon Button
          </h2>
          <div className="space-y-6">
            {(["primary", "secondary", "ghost", "destructive"] as const).map((variant) => (
              <div key={variant}>
                <h3 className="text-sm font-semibold text-text-secondary mb-3 capitalize">{variant}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <IconButton variant={variant} size="sm" ariaLabel="Play" icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                  <IconButton variant={variant} size="md" ariaLabel="Play" icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                  <IconButton variant={variant} size="lg" ariaLabel="Play" icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                  <IconButton variant={variant} size="md" disabled ariaLabel="Play" icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                  <IconButton variant={variant} size="md" loading ariaLabel="Play" icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-heading mb-6 pb-2 border-b border-border">
            Badge
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Variants</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="neutral">Draft</Badge>
                <Badge variant="primary">AI Analysis</Badge>
                <Badge variant="success">Completed</Badge>
                <Badge variant="warning">Pending</Badge>
                <Badge variant="error">Failed</Badge>
                <Badge variant="info">Processing</Badge>
                <Badge variant="positive">+12.4%</Badge>
                <Badge variant="negative">-3.2%</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="primary" size="sm">Small</Badge>
                <Badge variant="primary" size="md">Medium</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">With Leading Icon</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success" leadingIcon={<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}>Completed</Badge>
                <Badge variant="error" leadingIcon={<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}>Failed</Badge>
                <Badge variant="warning" leadingIcon={<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}>Pending</Badge>
              </div>
            </div>
          </div>
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
