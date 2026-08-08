"use client";

import * as React from "react";
import type { Company } from "@/features/companies/types/company";
import { CompanyGrid } from "@/features/companies/components/company-grid";
import { CompanyForm } from "@/features/companies/components/company-form";
import { DeleteCompanyDialog } from "@/features/companies/components/delete-company-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/features/companies/hooks/use-debounce";
import { useCompanies, useCreateCompany, useDeleteCompany } from "@/features/companies/hooks/use-companies";
import { useToast } from "@/components/ui/toast-provider";

export default function CompaniesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { data: companies, isLoading, error } = useCompanies();
  const createMutation = useCreateCompany();
  const deleteMutation = useDeleteCompany();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Company | null>(null);

  const [debouncedSearch] = useDebounce(searchQuery, 300);

  const handleCreate = async (data: { name: string; industry?: string; website?: string } | { name?: string; industry?: string; website?: string }) => {
    try {
      const response = await createMutation.mutateAsync(data as { name: string; industry?: string; website?: string });
      const created = response.data;
      setIsCreateDialogOpen(false);
      addToast({
        title: "Company created",
        description: "The company has been created successfully.",
        variant: "success",
        duration: 3000,
      });
      router.push(`/companies/${created.id}`);
      router.refresh();
    } catch {
      addToast({
        title: "Failed to create company",
        description: "Something went wrong. Please try again.",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      addToast({
        title: "Company deleted",
        description: "The company has been deleted successfully.",
        variant: "success",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Failed to delete company",
        description: "Something went wrong. Please try again.",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const filteredCompanies = React.useMemo(() => {
    if (!Array.isArray(companies)) return [];
    let result = [...companies];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [companies, debouncedSearch, sortOrder]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h2 font-semibold text-text-heading">Companies</h1>
          <p className="text-body text-text-secondary">Manage your companies and organizations</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Company
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={toggleSort} className="min-h-[44px]">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {sortOrder === "asc" ? "A-Z" : "Z-A"}
        </Button>
      </div>

      <div className="mt-6 flex-1">
        {error ? (
          <div className="rounded-md border border-error/50 bg-error/10 p-4 text-sm text-error">
            Failed to load companies. Please try again later.
          </div>
        ) : (
          <CompanyGrid
            companies={filteredCompanies}
            isLoading={isLoading}
            onCreateClick={() => setIsCreateDialogOpen(true)}
            onCompanyClick={(company) => router.push(`/companies/${company.id}`)}
          />
        )}
      </div>

      <CompanyForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />

      <DeleteCompanyDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        companyName={deleteTarget?.name ?? ""}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
