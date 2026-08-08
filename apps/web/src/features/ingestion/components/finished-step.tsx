"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface FinishedStepProps {
  statementId?: string;
  companyId: string;
}

export function FinishedStep({ statementId, companyId }: FinishedStepProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Card padding="md">
        <CardHeader>
          <CardTitle as="h3" className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Import Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            The financial statement has been created successfully. You can view it now or return to the company page.
          </p>

          <div className="flex gap-2">
            {statementId && (
              <Button
                variant="outline"
                onClick={() => router.push(`/financials/${statementId}`)}
                className="flex-1"
              >
                View Statement
              </Button>
            )}
            <Button onClick={() => router.push(`/companies/${companyId}`)} className="flex-1">
              Back to Company
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
