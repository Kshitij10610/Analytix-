"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { financialsApi } from "@/services/api/financials";
import { StatementDetailCards } from "@/features/financials/components/statement-detail-cards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import type { FinancialStatementWithLineItems } from "@/features/financials/types/financial-statement";

export default function FinancialStatementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const statementId = params.statementId as string;

  const { data: statement, isLoading, error } = useQuery({
    queryKey: ["financial-statements", statementId, "line-items"],
    queryFn: async () => {
      const response = await financialsApi.findOneWithLineItems(statementId);
      return response.data as FinancialStatementWithLineItems;
    },
    enabled: !!statementId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="rounded-md border border-error/50 bg-error/10 p-4 text-center">
          <p className="text-sm text-error">Financial statement not found or you don&apos;t have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-h2 font-semibold text-text-heading flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {statement.type.replace(/_/g, " ")}
          </h1>
          <p className="text-body text-text-secondary">
            Fiscal Year {statement.fiscalYear} • {statement.periodType}
          </p>
        </div>
      </div>

      <StatementDetailCards statement={statement} lineItems={statement.lineItems} />
    </div>
  );
}
