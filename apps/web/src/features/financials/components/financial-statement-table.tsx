"use client";

import * as React from "react";
import type { FinancialStatement } from "@/features/financials/types/financial-statement";
import { TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FinancialPeriodType, FinancialScale, FinancialDataSourceType } from "@/features/financials/types/financial-statement";

interface FinancialStatementTableProps {
  statements: FinancialStatement[];
  isLoading?: boolean;
  onView?: (statement: FinancialStatement) => void;
  onEdit?: (statement: FinancialStatement) => void;
  onDelete?: (statement: FinancialStatement) => void;
  onUpload?: () => void;
  onCreate?: () => void;
}

const periodTypeLabel: Record<FinancialPeriodType, string> = {
  ANNUAL: "Annual",
  QUARTERLY: "Quarterly",
  TTM: "TTM",
};

const scaleLabel: Record<FinancialScale, string> = {
  ONES: " ones",
  THOUSANDS: "K",
  MILLIONS: "M",
  BILLIONS: "B",
};

const sourceTypeLabel: Record<FinancialDataSourceType, string> = {
  MANUAL: "Manual",
  CSV_IMPORT: "CSV Import",
  API: "API",
  AI_EXTRACTED: "AI Extracted",
};

function StatementSkeletonRow() {
  return (
    <TableRow>
      <TableCell><div className="h-4 w-12 bg-surface-hover rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-24 bg-surface-hover rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-16 bg-surface-hover rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-20 bg-surface-hover rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-24 bg-surface-hover rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-32 bg-surface-hover rounded animate-pulse" /></TableCell>
    </TableRow>
  );
}

export function FinancialStatementTable({
  statements,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onUpload,
  onCreate,
}: FinancialStatementTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <StatementSkeletonRow key={i} />
            ))}
          </TableBody>
        </table>
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <FileUp className="h-12 w-12 text-text-muted" />
          <div>
            <h3 className="text-lg font-semibold text-text-heading">No financial statements found</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Get started by uploading a statement or creating one manually.
            </p>
          </div>
          <div className="flex gap-2">
            {onUpload && (
              <Button variant="outline" onClick={onUpload}>
                <FileUp className="mr-2 h-4 w-4" />
                Upload Statement
              </Button>
            )}
            {onCreate && (
              <Button onClick={onCreate}>Create Statement</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <table className="w-full caption-bottom text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statements.map((statement) => (
            <TableRow key={statement.id}>
              <TableCell className="font-medium">{statement.fiscalYear}</TableCell>
              <TableCell>
                {periodTypeLabel[statement.periodType]}
                {statement.fiscalQuarter ? ` Q${statement.fiscalQuarter}` : ""}
              </TableCell>
              <TableCell>
                {statement.currency}
                {scaleLabel[statement.scale]}
              </TableCell>
              <TableCell>
                {statement.sourceType ? sourceTypeLabel[statement.sourceType] : "—"}
              </TableCell>
              <TableCell className="text-text-secondary">
                {new Date(statement.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView?.(statement) ?? router.push(`/financials/${statement.id}`)}
                    aria-label="View statement"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit?.(statement)}
                    aria-label="Edit statement"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete?.(statement)}
                    aria-label="Delete statement"
                  >
                    <Trash2 className="h-4 w-4 text-error" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
