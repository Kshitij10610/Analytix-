"use client";

import * as React from "react";
import { useFinancialStatements } from "@/features/financials/hooks/use-financial-statements";
import { FinancialStatementTable } from "@/features/financials/components/financial-statement-table";
import { StatementUploadModal } from "@/features/financials/components/statement-upload-modal";
import { StatementCreateForm } from "@/features/financials/components/statement-create-form";
import { IngestionWizard } from "@/features/ingestion/components/ingestion-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileUp, Plus, Workflow } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface FinancialStatementsTabProps {
  companyId: string;
}

export function FinancialStatementsTab({ companyId }: FinancialStatementsTabProps) {
  const { data: statements, isLoading, error } = useFinancialStatements(companyId);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const { addToast } = useToast();

  const handleCreate = async (data: { type: string; periodStart: string; periodEnd: string; fiscalYear: number; periodType: string; currency: string; scale: string }) => {
    // This will be handled by the parent via mutation
    console.log("Create statement", data);
  };

  const handleUploadSuccess = (importJobId: string) => {
    addToast({
      title: "Upload started",
      description: `Import job ${importJobId.slice(0, 8)}... is being processed.`,
      variant: "success",
      duration: 3000,
    });
  };

  if (error) {
    return (
      <div className="rounded-md border border-error/50 bg-error/10 p-4 text-sm text-error">
        Failed to load financial statements. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setIsUploadOpen(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          Upload Statement
        </Button>
        <Button variant="secondary" onClick={() => setIsWizardOpen(true)}>
          <Workflow className="mr-2 h-4 w-4" />
          Import Wizard
        </Button>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Manually
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <FinancialStatementTable
          statements={statements ?? []}
          onUpload={() => setIsUploadOpen(true)}
          onCreate={() => setIsCreateOpen(true)}
        />
      )}

      <StatementUploadModal
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        companyId={companyId}
        onSuccess={handleUploadSuccess}
      />

      <StatementCreateForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
      />

      <IngestionWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        companyId={companyId}
      />
    </div>
  );
}
