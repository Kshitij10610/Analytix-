"use client";

import * as React from "react";
import { Building2, Globe, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Company } from "@/features/companies/types/company";
import { cn } from "@/lib/utils";

interface CompanyCardProps {
  company: Company;
  onClick?: (company: Company) => void;
  className?: string;
}

export function CompanyCard({ company, onClick, className }: CompanyCardProps) {
  return (
    <Card
      padding="md"
      className={cn(
        "cursor-pointer transition-colors hover:bg-surface-hover",
        onClick && "interactive",
        className
      )}
      onClick={() => onClick?.(company)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-spacing-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle as="h4" className="text-label font-semibold text-text-heading">
              {company.name}
            </CardTitle>
            {company.industry && (
              <p className="text-body-sm text-text-secondary">{company.industry}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-spacing-2 text-body-sm text-text-secondary">
          <Globe className="h-4 w-4" />
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {company.website}
            </a>
          ) : (
            <span>No website</span>
          )}
        </div>
        <div className="flex items-center gap-spacing-2 text-body-sm text-text-muted">
          <Calendar className="h-4 w-4" />
          Created {new Date(company.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
