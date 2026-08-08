"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { ValidationResponseDto } from "@/features/ingestion/types/ingestion";

interface ValidationStepProps {
  companyId: string;
  importJobId: string;
  onComplete: (response: ValidationResponseDto) => void;
}

export function ValidationStep({ companyId, importJobId, onComplete }: ValidationStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ValidationResponseDto | null>(null);
  const { addToast } = useToast();

  const handleValidate = async () => {
    setIsLoading(true);
    try {
      const response = await ingestionApi.validate(companyId, importJobId);
      setResult(response.data);
      onComplete(response.data);
      addToast({
        title: response.data.valid ? "Validation passed" : "Validation failed",
        description: response.data.valid
          ? "All validation rules passed."
          : `${response.data.totalErrorCount} errors found.`,
        variant: response.data.valid ? "success" : "error",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Validation failed",
        description: "Failed to validate the import. Please try again.",
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
          <p className="text-sm text-text-secondary mb-4">Click validate to check data integrity.</p>
          <Button onClick={handleValidate} disabled={isLoading}>
            {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Validate Data
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-error" />
                )}
                Validation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-body-sm text-text-muted">Total Errors</p>
                  <p className="text-sm font-medium text-text-primary">{result.totalErrorCount}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Status</p>
                  <Badge variant={result.valid ? "success" : "destructive"}>
                    {result.valid ? "Valid" : "Invalid"}
                  </Badge>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Statement Type</p>
                  <p className="text-sm font-medium text-text-primary">{result.statementType || "—"}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-text-heading">Errors</p>
                  {result.errors.map((error, index) => (
                    <div key={index} className="rounded-md border border-error/50 bg-error/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-error mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-error">{error.code}</p>
                          <p className="text-xs text-error/80">{error.message}</p>
                          {(error.sheetIndex !== undefined || error.rowNumber !== undefined) && (
                            <p className="text-xs text-error/60 mt-1">
                              Sheet {error.sheetIndex ?? "?"} • Row {error.rowNumber ?? "?"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
