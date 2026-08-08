"use client";

import * as React from "react";
import { useDashboardData } from "@/features/financials/hooks/use-dashboard";
import { KpiCard } from "@/features/financials/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
} from "@/components/primitives/select";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getLineItemValue,
  computeRatios,
  computeTrends,
  formatValue,
} from "@/features/financials/utils/analysis";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function DashboardPage() {
  const router = useRouter();
  const { data: statements, isLoading, error } = useDashboardData("current-company-id");
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);
  const [selectedType, setSelectedType] = React.useState<string>("INCOME_STATEMENT");

  const selectedStatement = statements?.find((s) => s.fiscalYear === selectedYear) || statements?.[0];
  const incomeStatements = statements?.filter((s) => s.type === "INCOME_STATEMENT") || [];
  const balanceSheets = statements?.filter((s) => s.type === "BALANCE_SHEET") || [];
  const cashFlows = statements?.filter((s) => s.type === "CASH_FLOW") || [];

  const availableYears = Array.from(new Set(statements?.map((s) => s.fiscalYear) || [])).sort((a, b) => b - a);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="rounded-md border border-error/50 bg-error/10 p-4 text-center">
          <p className="text-sm text-error">Failed to load dashboard data. Please try again later.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !statements) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-text-muted" />
          <h3 className="mt-4 text-lg font-semibold text-text-heading">No financial data available</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Upload or create financial statements to see analysis.
          </p>
          <Button className="mt-4" onClick={() => router.push("/companies")}>
            Go to Companies
          </Button>
        </div>
      </div>
    );
  }

  const currentStatement = selectedStatement || statements[0];
  const ratios = computeRatios(currentStatement);

  const revenueTrend = computeTrends(incomeStatements, "REVENUE");
  const profitTrend = computeTrends(incomeStatements, "NET_INCOME");

  const assetAllocation = balanceSheets[0]?.lineItems
    .filter((li) => ["CASH_AND_CASH_EQUIVALENTS", "SHORT_TERM_INVESTMENTS", "ACCOUNTS_RECEIVABLE", "INVENTORY", "PROPERTY_PLANT_EQUIPMENT", "GOODWILL", "INTANGIBLE_ASSETS"].includes(li.metricCode))
    .map((li) => ({ name: li.label, value: parseFloat(li.value) })) || [];

  const liabilityEquityData = [
    { name: "Total Liabilities", value: getLineItemValue(balanceSheets[0] || currentStatement, "TOTAL_LIABILITIES") },
    { name: "Total Equity", value: getLineItemValue(balanceSheets[0] || currentStatement, "TOTAL_EQUITY") },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h2 font-semibold text-text-heading">Financial Analysis</h1>
          <p className="text-body text-text-secondary">
            {statements.length} statements available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedYear?.toString() || ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={availableYears.map((y) => ({ value: y.toString(), label: `FY${y}` }))}
            className="w-40"
          />
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            options={[
              { value: "INCOME_STATEMENT", label: "Income Statement" },
              { value: "BALANCE_SHEET", label: "Balance Sheet" },
              { value: "CASH_FLOW", label: "Cash Flow" },
            ]}
            className="w-48"
          />
        </div>
      </div>

      <section>
        <h2 className="text-h3 font-semibold text-text-heading mb-4">Executive Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ratios.slice(0, 8).map((ratio) => (
            <KpiCard
              key={ratio.name}
              title={ratio.name}
              value={ratio.value !== null ? formatValue(ratio.value, ratio.format) : "N/A"}
              tooltip={ratio.description}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold text-text-heading mb-4">Financial Statements</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {balanceSheets[0]?.lineItems
                  .filter((li) => ["CASH_AND_CASH_EQUIVALENTS", "TOTAL_ASSETS", "TOTAL_LIABILITIES", "TOTAL_EQUITY"].includes(li.metricCode))
                  .map((item) => (
                    <div key={item.metricCode} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                      <span className="text-sm text-text-secondary">{item.label}</span>
                      <span className="text-sm font-medium text-text-primary">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parseFloat(item.value))}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incomeStatements[0]?.lineItems
                  .filter((li) => ["REVENUE", "COST_OF_REVENUE", "GROSS_PROFIT", "OPERATING_INCOME", "NET_INCOME"].includes(li.metricCode))
                  .map((item) => (
                    <div key={item.metricCode} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                      <span className="text-sm text-text-secondary">{item.label}</span>
                      <span className="text-sm font-medium text-text-primary">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parseFloat(item.value))}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cashFlows[0]?.lineItems
                  .filter((li) => ["OPERATING_CASH_FLOW", "INVESTING_CASH_FLOW", "FINANCING_CASH_FLOW", "NET_CHANGE_IN_CASH"].includes(li.metricCode))
                  .map((item) => (
                    <div key={item.metricCode} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                      <span className="text-sm text-text-secondary">{item.label}</span>
                      <span className="text-sm font-medium text-text-primary">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parseFloat(item.value))}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold text-text-heading mb-4">Charts</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Profit Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={profitTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#82ca9d" name="Net Income" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Asset Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={assetAllocation}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {assetAllocation.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Liabilities vs Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={liabilityEquityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold text-text-heading mb-4">Financial Ratios</h2>
        <Card padding="md">
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-body-sm font-medium text-text-secondary">Ratio</th>
                    <th className="px-4 py-2 text-right text-body-sm font-medium text-text-secondary">Value</th>
                    <th className="px-4 py-2 text-left text-body-sm font-medium text-text-secondary hidden lg:table-cell">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ratios.map((ratio) => (
                    <tr key={ratio.name} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium text-text-primary">{ratio.name}</td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {ratio.value !== null ? formatValue(ratio.value, ratio.format) : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{ratio.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="mt-auto pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <AlertTriangle className="h-4 w-4" />
            <span>Export to PDF, CSV, and Excel requires backend endpoints.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" disabled>
              <FileText className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
