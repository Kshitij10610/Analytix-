"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FinancialStatementWithLineItems } from "@/features/financials/types/financial-statement";

interface StatementTreeProps {
  statement: FinancialStatementWithLineItems;
  groups: { label: string; items: { code: string; label: string; value: number }[] }[];
  title: string;
}

export function StatementTree({ statement, groups, title }: StatementTreeProps) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsed((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle as="h3">{title}</CardTitle>
        <p className="text-sm text-text-secondary">
          {statement.fiscalYear} • {statement.periodType} • {statement.currency}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {groups.map((group) => {
            const groupName = group.label || "Other";
            const items = group.items || [];
            const isCollapsed = collapsed[groupName];

            return (
              <div key={groupName} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="flex w-full items-center justify-between py-2 text-left"
                >
                  <span className="text-sm font-medium text-text-heading">{groupName}</span>
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="space-y-1 pb-2">
                    {items.map((item) => (
                      <div key={item.code} className="flex items-center justify-between py-1">
                        <span className="text-sm text-text-secondary">{item.label}</span>
                        <span className="text-sm font-medium text-text-primary">
                          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
