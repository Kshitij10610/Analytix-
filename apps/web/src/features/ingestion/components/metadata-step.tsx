"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
} from "@/components/primitives/select";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { z } from "zod";
import type { StatementMetadataResponse } from "@/features/ingestion/types/ingestion";

interface MetadataStepProps {
  companyId: string;
  importJobId: string;
  onComplete: (response: StatementMetadataResponse) => void;
}

const metadataSchema = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  fiscalYear: z.number().int().min(1900).max(2100),
  periodType: z.enum(["ANNUAL", "QUARTERLY", "TTM"]),
  currency: z.string().length(3, "Currency must be 3 letters"),
  scale: z.enum(["ONES", "THOUSANDS", "MILLIONS", "BILLIONS"]),
});

type MetadataFormData = z.infer<typeof metadataSchema>;

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

export function MetadataStep({ companyId, importJobId, onComplete }: MetadataStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MetadataFormData>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      periodStart: "",
      periodEnd: "",
      fiscalYear: new Date().getFullYear(),
      periodType: "ANNUAL",
      currency: "USD",
      scale: "ONES",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() cannot be memoized safely
  const watchedPeriodType = watch("periodType");

  const onSubmit = async (data: MetadataFormData) => {
    setIsLoading(true);
    try {
      const response = await ingestionApi.finalizeMetadata(companyId, importJobId, data);
      addToast({
        title: "Metadata saved",
        description: "Statement metadata has been updated.",
        variant: "success",
        duration: 3000,
      });
      onComplete(response.data);
    } catch {
      addToast({
        title: "Failed to save metadata",
        description: "Something went wrong. Please try again.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            onChange={(e) => setValue("periodType", e.target.value as MetadataFormData["periodType"])}
            options={periodTypeOptions}
            errorMessage={errors.periodType?.message}
          />
        </div>
      </div>

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
            onChange={(e) => setValue("scale", e.target.value as MetadataFormData["scale"])}
            options={scaleOptions}
            errorMessage={errors.scale?.message}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting || isLoading ? "Saving..." : "Save Metadata"}
        </Button>
      </div>
    </form>
  );
}
