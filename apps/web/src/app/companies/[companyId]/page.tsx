"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api/companies";
import type { Company } from "@/features/companies/types/company";
import { CompanyMembersTable } from "@/features/companies/components/company-members-table";
import { CompanyForm } from "@/features/companies/components/company-form";
import { DeleteCompanyDialog } from "@/features/companies/components/delete-company-dialog";
import { FinancialStatementsTab } from "@/features/financials/components/financial-statements-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Edit, Trash2, Users, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useParams, useRouter } from "next/navigation";
import { useUpdateCompany, useDeleteCompany } from "@/features/companies/hooks/use-companies";

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const companyId = params.companyId as string;
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = React.useState("overview");

  const { data: company, isLoading, error } = useQuery({
    queryKey: ["companies", companyId],
    queryFn: async () => {
      const response = await companiesApi.findOne(companyId);
      return response.data as Company;
    },
    enabled: !!companyId,
  });

  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(false);

  const handleUpdate = async (data: { name?: string; industry?: string; website?: string }) => {
    if (!company) return;
    try {
      await updateMutation.mutateAsync({ id: company.id, data });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["companies", company.id] });
      addToast({
        title: "Company updated",
        description: "The company has been updated successfully.",
        variant: "success",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Failed to update company",
        description: "Something went wrong. Please try again.",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    try {
      await deleteMutation.mutateAsync(company.id);
      addToast({
        title: "Company deleted",
        description: "The company has been deleted successfully.",
        variant: "success",
        duration: 3000,
      });
      router.push("/companies");
      router.refresh();
    } catch {
      addToast({
        title: "Failed to delete company",
        description: "Something went wrong. Please try again.",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      title: "Copied",
      description: "Company ID copied to clipboard",
      variant: "success",
      duration: 2000,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="rounded-md border border-error/50 bg-error/10 p-4 text-center">
          <p className="text-sm text-error">Company not found or you don&apos;t have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/companies")}>
            Back to Companies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h2 font-semibold text-text-heading">{company.name}</h1>
          <p className="text-body text-text-secondary">Company details and management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteTarget(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financial Statements</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Company Name</p>
                  <p className="text-sm font-medium text-text-primary">{company.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Industry</p>
                  <p className="text-sm font-medium text-text-primary">{company.industry || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Website</p>
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      {company.website}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-text-primary">—</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Owner</p>
                  <p className="text-sm font-medium text-text-primary">
                    {company.ownerId ? `User ${company.ownerId.slice(0, 8)}...` : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Company ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-text-primary">{company.id}</p>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(company.id)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Created</p>
                  <p className="text-sm font-medium text-text-primary">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-body-sm text-text-muted">Last Updated</p>
                  <p className="text-sm font-medium text-text-primary">
                    {new Date(company.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials">
          <FinancialStatementsTab companyId={company.id} />
        </TabsContent>

        <TabsContent value="members">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyMembersTable companyId={company.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary">Audit log will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CompanyForm
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleUpdate}
        company={company}
      />

      <DeleteCompanyDialog
        open={deleteTarget}
        onOpenChange={setDeleteTarget}
        onConfirm={handleDelete}
        companyName={company.name}
      />
    </div>
  );
}

