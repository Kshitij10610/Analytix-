"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import type { NormalizationResponseDto } from "@/features/ingestion/types/ingestion";

interface NormalizeStepProps {
  companyId: string;
  importJobId: string;
  onComplete: (response: NormalizationResponseDto) => void;
}

export function NormalizeStep({ companyId, importJobId, onComplete }: NormalizeStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<NormalizationResponseDto | null>(null);
  const { addToast } = useToast();

  const handleNormalize = async () => {
    setIsLoading(true);
    try {
      const response = await ingestionApi.normalize(companyId, importJobId);
      setResult(response.data);
      onComplete(response.data);
      addToast({
        title: "Normalization complete",
        description: `${response.data.normalizedRowCount} rows normalized.`,
        variant: "success",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Normalization failed",
        description: "Failed to normalize the import. Please try again.",
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
          <p className="text-sm text-text-secondary mb-4">Click normalize to transform data into standard metrics.</p>
          <Button onClick={handleNormalize} disabled={isLoading}>
            {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Normalize Data
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Normalization Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-body-sm text-text-muted">Normalized Rows</p>
                  <p className="text-sm font-medium text-text-primary">{result.normalizedRowCount}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Status</p>
                  <Badge variant={result.valid ? "success" : "warning"}>
                    {result.valid ? "Ready" : "Blocked"}
                  </Badge>
                </div>
              </div>

              {result.readyBlockedReason && (
                <div className="rounded-md border border-warning/50 bg-warning/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-warning">Blocked</p>
                      <p className="text-xs text-warning/80">{result.readyBlockedReason}</p>
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
