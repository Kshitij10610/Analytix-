"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface EmptyCompaniesStateProps {
  onCreateClick?: () => void;
}

export function EmptyCompaniesState({ onCreateClick }: EmptyCompaniesStateProps) {
  return (
    <EmptyState
      icon={<Building2 className="h-12 w-12" />}
      title="No companies found"
      description="Get started by creating your first company or adjusting your search criteria."
      action={
        onCreateClick ? (
          <Button onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            Create Company
          </Button>
        ) : undefined
      }
    />
  );
}
