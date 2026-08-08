"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/services/api/companies";
import type { Company } from "@/features/companies/types/company";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "selected_company_id";

export function CompanySwitcher() {
  const router = useRouter();
  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await companiesApi.findAll();
      return response.data ?? [];
    },
  });

  const selectedId = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
  const companiesArray = Array.isArray(companies) ? companies : [];
  const selectedCompany = companiesArray.find((c) => c.id === selectedId) ?? companiesArray[0] ?? null;

  const handleSelect = (company: Company) => {
    sessionStorage.setItem(STORAGE_KEY, company.id);
    router.push(`/companies/${company.id}`);
    router.refresh();
  };

  const handleCreate = () => {
    router.push("/companies/new");
  };

  if (isLoading || !selectedCompany) {
    return <Skeleton className="h-9 w-48" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-spacing-2 min-h-[44px]">
          <span className="truncate max-w-[150px]">{selectedCompany.name}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companiesArray.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleSelect(company)}
            className={company.id === selectedCompany.id ? "bg-surface-selected" : ""}
          >
            <span className="truncate">{company.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
