"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { RefreshCw, CheckCircle, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CommitResponse } from "@/features/ingestion/types/ingestion";

interface CommitStepProps {
  companyId: string;
  importJobId: string;
  onComplete: (response: CommitResponse) => void;
}

export function CommitStep({ companyId, importJobId, onComplete }: CommitStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<CommitResponse | null>(null);
  const router = useRouter();
  const { addToast } = useToast();

  const handleCommit = async () => {
    setIsLoading(true);
    try {
      const response = await ingestionApi.commit(companyId, importJobId);
      setResult(response.data);
      onComplete(response.data);
      addToast({
        title: "Statement created",
        description: `Financial statement ${response.data.statementId} created successfully.`,
        variant: "success",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Commit failed",
        description: "Failed to create financial statement. Please try again.",
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
          <p className="text-sm text-text-secondary mb-4">Click commit to create the financial statement.</p>
          <Button onClick={handleCommit} disabled={isLoading}>
            {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Commit Statement
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Statement Created
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-body-sm text-text-muted">Statement ID</p>
                  <p className="text-sm font-medium text-text-primary font-mono">{result.statementId}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Type</p>
                  <Badge variant="success">{result.statementType}</Badge>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Line Items</p>
                  <p className="text-sm font-medium text-text-primary">{result.lineItemCount}</p>
                </div>
                <div>
                  <p className="text-body-sm text-text-muted">Currency</p>
                  <p className="text-sm font-medium text-text-primary">{result.currency}</p>
                </div>
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/financials/${result.statementId}`)}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
