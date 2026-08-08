"use client";

import * as React from "react";
import type { Company } from "@/features/companies/types/company";
import { CompanyCard } from "@/features/companies/components/company-card";
import { EmptyCompaniesState } from "@/features/companies/components/empty-companies-state";

interface CompanyGridProps {
  companies: Company[];
  isLoading?: boolean;
  onCompanyClick?: (company: Company) => void;
  onCreateClick?: () => void;
}

export function CompanyGrid({ companies, isLoading, onCompanyClick, onCreateClick }: CompanyGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-card p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-surface-hover" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-surface-hover rounded" />
                <div className="h-3 w-24 bg-surface-hover rounded" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full bg-surface-hover rounded" />
              <div className="h-3 w-2/3 bg-surface-hover rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <EmptyCompaniesState onCreateClick={onCreateClick} />
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard
          key={company.id}
          company={company}
          onClick={onCompanyClick}
        />
      ))}
    </div>
  );
}
