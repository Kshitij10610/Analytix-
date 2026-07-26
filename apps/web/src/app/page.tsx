"use client"

import { AppShell } from "@/components/app-shell"
import { PageHeader, PageContent, PageSection, DashboardSection, DashboardGrid, DashboardRow, DashboardColumn } from "@/components/app-layout"
import { MetricCard } from "@/components/primitives"
import { ChartContainer } from "@/components/primitives"
import { DataTable, CurrencyCell, PercentageCell, TrendCell, StatusCell } from "@/components/primitives"

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

const navItems = [
  {
    id: "/",
    label: "Dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "/reports",
    label: "Reports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "/companies",
    label: "Companies",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4 8 4v14" />
        <path d="M9 9h1" />
        <path d="M9 13h1" />
        <path d="M14 9h1" />
        <path d="M14 13h1" />
      </svg>
    ),
  },
  {
    id: "/settings",
    label: "Settings",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: "/financials",
    label: "Financials",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
]

export default function Home() {
  return (
    <AppShell navItems={navItems} headerTitle="Dashboard">
      <PageContent maxWidth="content">
        <PageHeader
          title="Financial Overview"
          description="Performance overview and key financial metrics"
          breadcrumb={[
            { label: "Home" },
            { label: "Dashboard" },
          ]}
        />

        <DashboardSection>
          <DashboardGrid columns={4}>
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
          </DashboardGrid>
        </DashboardSection>

        <DashboardSection>
          <DashboardRow>
            <DashboardColumn span={2}>
              <PageSection title="Revenue Trend" description="FY22 – FY26">
                <ChartContainer title="Revenue Trend" description="FY22 – FY26">
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <span className="text-body-sm text-text-muted">LineChart placeholder — Recharts React 19 compatibility pending</span>
                  </div>
                </ChartContainer>
              </PageSection>
            </DashboardColumn>
            <DashboardColumn span={1}>
              <PageSection title="Free Cash Flow" description="Recent performance">
                <ChartContainer title="Free Cash Flow" description="Recent performance">
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <span className="text-body-sm text-text-muted">Chart placeholder</span>
                  </div>
                </ChartContainer>
              </PageSection>
            </DashboardColumn>
          </DashboardRow>
        </DashboardSection>

        <DashboardSection>
          <PageSection title="Financial Performance" description="Company overview">
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
          </PageSection>
        </DashboardSection>
      </PageContent>
    </AppShell>
  )
}
