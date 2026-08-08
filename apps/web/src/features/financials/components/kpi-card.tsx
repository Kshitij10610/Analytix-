"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  tooltip?: string;
  isLoading?: boolean;
}

export function KpiCard({ title, value, trend, trendValue, tooltip, isLoading }: KpiCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-text-secondary";

  if (isLoading) {
    return (
      <Card padding="md">
        <CardContent className="space-y-3">
          <div className="h-4 w-24 bg-surface-hover rounded animate-pulse" />
          <div className="h-8 w-32 bg-surface-hover rounded animate-pulse" />
          <div className="h-3 w-16 bg-surface-hover rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle as="h4" className="text-label font-medium text-text-secondary">
            {title}
          </CardTitle>
          {tooltip && (
            <Tooltip content={tooltip}>
              <Info className="h-3.5 w-3.5 text-text-muted cursor-help" />
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-text-heading">{value}</div>
        {trend && trendValue && (
          <div className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
