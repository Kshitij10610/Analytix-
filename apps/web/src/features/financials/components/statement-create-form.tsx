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
import {
  Select,
} from "@/components/primitives/select";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
import {
  createFinancialStatementSchema,
  type CreateFinancialStatementFormData,
} from "@/features/financials/validations/financial-statement.schemas";
import { useToast } from "@/components/ui/toast-provider";

interface StatementCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateFinancialStatementFormData) => Promise<void>;
  isLoading?: boolean;
}

const statementTypeOptions: SelectOption[] = [
  { value: "INCOME_STATEMENT", label: "Income Statement" },
  { value: "BALANCE_SHEET", label: "Balance Sheet" },
  { value: "CASH_FLOW", label: "Cash Flow" },
];

const periodTypeOptions: SelectOption[] = [
  { value: "ANNUAL", label: "Annual" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "TTM", label: "TTM" },
];

const scaleOptions: SelectOption[] = [
  { value: "ONES", label: "Ones" },
  { value: "THOUSANDS", label: "Thousands" },
  { value: "MILLIONS", label: "Millions" },
  { value: "BILLIONS", label: "Billions" },
];

export function StatementCreateForm({ open, onOpenChange, onSubmit, isLoading }: StatementCreateFormProps) {
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateFinancialStatementFormData>({
    resolver: zodResolver(createFinancialStatementSchema),
    defaultValues: {
      type: "INCOME_STATEMENT",
      periodStart: "",
      periodEnd: "",
      fiscalYear: new Date().getFullYear(),
      periodType: "ANNUAL",
      currency: "USD",
      scale: "ONES",
      sourceType: "MANUAL",
      sourceReference: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        type: "INCOME_STATEMENT",
        periodStart: "",
        periodEnd: "",
        fiscalYear: new Date().getFullYear(),
        periodType: "ANNUAL",
        currency: "USD",
        scale: "ONES",
        sourceType: "MANUAL",
        sourceReference: "",
      });
    }
  }, [open, reset]);

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() cannot be memoized safely
  const watchedPeriodType = watch("periodType");

  const handleFormSubmit = async (data: CreateFinancialStatementFormData) => {
    try {
      await onSubmit(data);
      addToast({
        title: "Statement created",
        description: "The financial statement has been created successfully.",
        variant: "success",
        duration: 3000,
      });
      onOpenChange(false);
    } catch {
      addToast({
        title: "Failed to create statement",
        description: "Something went wrong. Please try again.",
        variant: "error",
        duration: 5000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Financial Statement</DialogTitle>
          <DialogDescription>Enter the details for the new financial statement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium text-text-primary">
              Statement Type <span className="text-error">*</span>
            </label>
            <Select
              id="type"
              value={watch("type")}
              onChange={(e) => setValue("type", e.target.value as CreateFinancialStatementFormData["type"])}
              options={statementTypeOptions}
              errorMessage={errors.type?.message}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="periodStart" className="text-sm font-medium text-text-primary">
                Period Start <span className="text-error">*</span>
              </label>
              <Input
                id="periodStart"
                type="date"
                errorMessage={errors.periodStart?.message}
                {...register("periodStart")}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="periodEnd" className="text-sm font-medium text-text-primary">
                Period End <span className="text-error">*</span>
              </label>
              <Input
                id="periodEnd"
                type="date"
                errorMessage={errors.periodEnd?.message}
                {...register("periodEnd")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="fiscalYear" className="text-sm font-medium text-text-primary">
                Fiscal Year <span className="text-error">*</span>
              </label>
              <Input
                id="fiscalYear"
                type="number"
                errorMessage={errors.fiscalYear?.message}
                {...register("fiscalYear", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="periodType" className="text-sm font-medium text-text-primary">
                Period Type <span className="text-error">*</span>
              </label>
              <Select
                id="periodType"
                value={watchedPeriodType}
                onChange={(e) => setValue("periodType", e.target.value as CreateFinancialStatementFormData["periodType"])}
                options={periodTypeOptions}
                errorMessage={errors.periodType?.message}
                required
              />
            </div>
          </div>

          {watchedPeriodType === "QUARTERLY" && (
            <div className="space-y-2">
              <label htmlFor="fiscalQuarter" className="text-sm font-medium text-text-primary">
                Fiscal Quarter
              </label>
              <Select
                id="fiscalQuarter"
                value={watch("fiscalQuarter")?.toString() ?? ""}
                onChange={(e) => setValue("fiscalQuarter", e.target.value ? Number(e.target.value) : null)}
                options={[
                  { value: "1", label: "Q1" },
                  { value: "2", label: "Q2" },
                  { value: "3", label: "Q3" },
                  { value: "4", label: "Q4" },
                ]}
                placeholder="Select quarter"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="currency" className="text-sm font-medium text-text-primary">
                Currency <span className="text-error">*</span>
              </label>
              <Input
                id="currency"
                placeholder="USD"
                errorMessage={errors.currency?.message}
                {...register("currency")}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="scale" className="text-sm font-medium text-text-primary">
                Scale <span className="text-error">*</span>
              </label>
              <Select
                id="scale"
                value={watch("scale")}
                onChange={(e) => setValue("scale", e.target.value as CreateFinancialStatementFormData["scale"])}
                options={scaleOptions}
                errorMessage={errors.scale?.message}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="sourceReference" className="text-sm font-medium text-text-primary">
              Reference / Notes
            </label>
            <Input
              id="sourceReference"
              placeholder="Optional reference or notes"
              {...register("sourceReference")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting || isLoading ? "Creating..." : "Create Statement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
