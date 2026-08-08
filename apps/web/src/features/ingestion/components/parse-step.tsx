"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { ParseResponseDto } from "@/features/ingestion/types/ingestion";

interface ParseStepProps {
  companyId: string;
  importJobId: string;
  onComplete: (response: ParseResponseDto) => void;
}

export function ParseStep({ companyId, importJobId, onComplete }: ParseStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ParseResponseDto | null>(null);
  const { addToast } = useToast();

  const handleParse = async () => {
    setIsLoading(true);
    try {
      const response = await ingestionApi.parse(companyId, importJobId);
      setResult(response.data);
      onComplete(response.data);
      addToast({
        title: "Parse complete",
        description: `Parsed ${response.data.parseSummary.totalDataRows} rows successfully.`,
        variant: "success",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Parse failed",
        description: "Failed to parse the file. Please try again.",
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
          <p className="text-sm text-text-secondary mb-4">Click parse to process the uploaded file.</p>
          <Button onClick={handleParse} disabled={isLoading}>
            {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Parse File
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Parse Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-body-sm text-text-muted">Total Rows</p>
                  <p className="text-sm font-medium text-text-primary">{result.parseSummary.totalDataRows}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Sheets</p>
                  <p className="text-sm font-medium text-text-primary">{result.parseSummary.sheetCount}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Format</p>
                  <p className="text-sm font-medium text-text-primary">{result.parseSummary.format}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Empty Sheets</p>
                  <p className="text-sm font-medium text-text-primary">{result.parseSummary.emptySheetCount}</p>
                </div>
              </div>

              {result.parseSummary.error && (
                <div className="rounded-md border border-error/50 bg-error/10 p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-error mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-error">Parse Error</p>
                      <p className="text-xs text-error/80">{result.parseSummary.error.message}</p>
                      {result.parseSummary.error.detail && (
                        <p className="text-xs text-error/60 mt-1">{result.parseSummary.error.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.parseSummary.formulaCellCount > 0 && (
                <div className="rounded-md border border-warning/50 bg-warning/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-warning">Warning</p>
                      <p className="text-xs text-warning/80">
                        {result.parseSummary.formulaCellCount} formula cells detected. Values may not be preserved.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
