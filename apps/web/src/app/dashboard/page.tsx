"use client"

import { PageHeader, PageContent, PageSection, DashboardSection, DashboardGrid, DashboardRow, DashboardColumn } from "@/components/app-layout"
import { MetricCard } from "@/components/primitives"
import { ChartContainer, LineChart } from "@/components/primitives"
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

const revenueTrendData = [
  { period: "FY22", revenue: 120, profit: 18 },
  { period: "FY23", revenue: 145, profit: 22 },
  { period: "FY24", revenue: 168, profit: 26 },
  { period: "FY25", revenue: 195, profit: 31 },
  { period: "FY26", revenue: 230, profit: 38 },
]

const cashFlowData = [
  { period: "FY22", fcf: 15 },
  { period: "FY23", fcf: 19 },
  { period: "FY24", fcf: 23 },
  { period: "FY25", fcf: 28 },
  { period: "FY26", fcf: 33 },
]

export default function DashboardPage() {
  return (
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
                <LineChart
                  data={revenueTrendData}
                  xAxisDataKey="period"
                  series={[
                    { dataKey: "revenue", label: "Revenue" },
                    { dataKey: "profit", label: "Profit" },
                  ]}
                  accessibleLabel="Revenue and profit trend from FY22 to FY26"
                  valueFormatter={(value) => `₹${value}`}
                />
              </ChartContainer>
            </PageSection>
          </DashboardColumn>
          <DashboardColumn span={1}>
            <PageSection title="Free Cash Flow" description="Recent performance">
              <ChartContainer title="Free Cash Flow" description="Recent performance">
                <LineChart
                  data={cashFlowData}
                  xAxisDataKey="period"
                  series={[
                    { dataKey: "fcf", label: "FCF" },
                  ]}
                  accessibleLabel="Free cash flow trend"
                  valueFormatter={(value) => `₹${value}`}
                />
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
  )
}
