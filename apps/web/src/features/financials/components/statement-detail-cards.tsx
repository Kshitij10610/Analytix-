"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatementLineItem } from "@/features/financials/types/financial-statement";

interface StatementDetailCardsProps {
  statement: {
    id: string;
    type: "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW";
    fiscalYear: number;
    periodType: string;
    currency: string;
    scale: string;
    periodStart: string;
    periodEnd: string;
  };
  lineItems: StatementLineItem[];
}

const typeConfig = {
  INCOME_STATEMENT: { label: "Income Statement", icon: "📊", color: "success" as const },
  BALANCE_SHEET: { label: "Balance Sheet", icon: "📋", color: "info" as const },
  CASH_FLOW: { label: "Cash Flow", icon: "💰", color: "warning" as const },
};

const categoryOrder: Record<string, number> = {
  REVENUE: 0,
  COGS: 1,
  OPERATING_EXPENSES: 2,
  NET_INCOME: 3,
  CURRENT_ASSETS: 0,
  NON_CURRENT_ASSETS: 1,
  CURRENT_LIABILITIES: 2,
  NON_CURRENT_LIABILITIES: 3,
  EQUITY: 4,
  OPERATING: 0,
  INVESTING: 1,
  FINANCING: 2,
};

function groupLineItems(items: StatementLineItem[]) {
  const groups: Record<string, StatementLineItem[]> = {};
  for (const item of items) {
    const category = item.metricCode.split("_")[0] || "OTHER";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  }
  return groups;
}

export function StatementDetailCards({ statement, lineItems }: StatementDetailCardsProps) {
  const config = typeConfig[statement.type] || typeConfig.INCOME_STATEMENT;
  const groups = groupLineItems(lineItems);
  const sortedCategories = Object.keys(groups).sort((a, b) => (categoryOrder[a] ?? 99) - (categoryOrder[b] ?? 99));

  return (
    <div className="space-y-6">
      <Card padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle as="h3" className="flex items-center gap-2">
              <span>{config.icon}</span>
              {config.label}
            </CardTitle>
            <Badge variant={config.color}>
              {statement.periodType}
              {statement.fiscalYear}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-body-sm text-text-muted">Currency</p>
              <p className="text-sm font-medium text-text-primary">{statement.currency}</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-text-muted">Scale</p>
              <p className="text-sm font-medium text-text-primary">{statement.scale}</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-text-muted">Period Start</p>
              <p className="text-sm font-medium text-text-primary">{new Date(statement.periodStart).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-text-muted">Period End</p>
              <p className="text-sm font-medium text-text-primary">{new Date(statement.periodEnd).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedCategories.map((category) => (
        <Card key={category} padding="md">
          <CardHeader>
            <CardTitle as="h4" className="text-label font-semibold text-text-heading">
              {category.replace(/_/g, " ")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groups[category].map((item) => (
                <div key={item.metricCode} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{item.label}</p>
                    <p className="text-xs text-text-muted font-mono">{item.metricCode}</p>
                  </div>
                  <p className="text-sm font-medium text-text-heading ml-4">
                    {new Intl.NumberFormat("en-US", {
                      style: "decimal",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(Number(item.value))}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
