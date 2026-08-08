"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCompanySchema, updateCompanySchema, type CreateCompanyFormData, type UpdateCompanyFormData } from "@/features/companies/validations/company.schemas";
import type { Company } from "@/features/companies/types/company";

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCompanyFormData | UpdateCompanyFormData) => Promise<void>;
  company?: Company | null;
  isLoading?: boolean;
}

export function CompanyForm({ open, onOpenChange, onSubmit, company, isLoading }: CompanyFormProps) {
  const isEditing = !!company;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyFormData | UpdateCompanyFormData>({
    resolver: zodResolver(isEditing ? updateCompanySchema : createCompanySchema),
    defaultValues: {
      name: company?.name ?? "",
      industry: company?.industry ?? "",
      website: company?.website ?? "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: company?.name ?? "",
        industry: company?.industry ?? "",
        website: company?.website ?? "",
      });
    }
  }, [open, company, reset]);

  const handleFormSubmit = async (data: CreateCompanyFormData | UpdateCompanyFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Company" : "Create Company"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the company details below."
              : "Fill in the details to create a new company."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-text-primary">
              Company Name <span className="text-error">*</span>
            </label>
            <Input
              id="name"
              placeholder="Acme Inc."
              disabled={isSubmitting || isLoading}
              errorMessage={errors.name?.message as string | undefined}
              {...register("name")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="industry" className="text-sm font-medium text-text-primary">
              Industry
            </label>
            <Input
              id="industry"
              placeholder="Technology"
              disabled={isSubmitting || isLoading}
              errorMessage={errors.industry?.message as string | undefined}
              {...register("industry")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="website" className="text-sm font-medium text-text-primary">
              Website
            </label>
            <Input
              id="website"
              placeholder="https://example.com"
              disabled={isSubmitting || isLoading}
              errorMessage={errors.website?.message as string | undefined}
              {...register("website")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting || isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
