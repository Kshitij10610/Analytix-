"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { RefreshCw, CheckCircle } from "lucide-react";
import type { StageResponseDto } from "@/features/ingestion/types/ingestion";

interface StageStepProps {
  companyId: string;
  importJobId: string;
  onComplete: (response: StageResponseDto) => void;
}

export function StageStep({ companyId, importJobId, onComplete }: StageStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<StageResponseDto | null>(null);
  const { addToast } = useToast();

  const handleStage = async () => {
    setIsLoading(true);
    try {
      const response = await ingestionApi.stage(companyId, importJobId);
      setResult(response.data);
      onComplete(response.data);
      addToast({
        title: "Staging complete",
        description: `${response.data.stagedRowCount} rows staged successfully.`,
        variant: "success",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Staging failed",
        description: "Failed to stage the import. Please try again.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-text-secondary mb-4">Click stage to prepare data for mapping.</p>
          <Button onClick={handleStage} disabled={isLoading}>
            {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Stage Data
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Staging Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-body-sm text-text-muted">Staged Rows</p>
                  <p className="text-sm font-medium text-text-primary">{result.stagedRowCount}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Sheets</p>
                  <p className="text-sm font-medium text-text-primary">{result.sheetCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
