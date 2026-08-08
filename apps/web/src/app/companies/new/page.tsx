"use client";

import { CompanyForm } from "@/features/companies/components/company-form";
import { useRouter } from "next/navigation";
import { useCreateCompany } from "@/features/companies/hooks/use-companies";
import { useToast } from "@/components/ui/toast-provider";

export default function NewCompanyPage() {
  const router = useRouter();
  const createMutation = useCreateCompany();
  const { addToast } = useToast();

  const handleSubmit = async (data: { name: string; industry?: string; website?: string } | { name?: string; industry?: string; website?: string }) => {
    try {
      const response = await createMutation.mutateAsync(data as { name: string; industry?: string; website?: string });
      const created = response.data;
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6">
        <h1 className="text-h2 font-semibold text-text-heading">New Company</h1>
        <p className="text-body text-text-secondary">Create a new company to get started</p>
      </div>

      <div className="max-w-2xl">
        <CompanyForm
          open={true}
          onOpenChange={(open) => {
            if (!open) router.back();
          }}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending}
        />
      </div>
    </div>
  );
}
