import { z } from "zod";

export const financialStatementTypeValues = ["INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW"] as const;
export const periodTypeValues = ["ANNUAL", "QUARTERLY", "TTM"] as const;
export const scaleValues = ["ONES", "THOUSANDS", "MILLIONS", "BILLIONS"] as const;
export const dataSourceTypeValues = ["MANUAL", "CSV_IMPORT", "API", "AI_EXTRACTED"] as const;

export const createFinancialStatementSchema = z.object({
  type: z.enum(financialStatementTypeValues, { message: "Statement type is required" }),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  fiscalYear: z.number().int().min(1900).max(2100, "Fiscal year must be between 1900 and 2100"),
  fiscalQuarter: z.number().int().min(1).max(4).optional().nullable(),
  periodType: z.enum(periodTypeValues, { message: "Period type is required" }),
  currency: z.string().length(3, "Currency must be a 3-letter code (e.g. USD)"),
  scale: z.enum(scaleValues, { message: "Scale is required" }),
  sourceType: z.enum(dataSourceTypeValues).optional().nullable(),
  sourceReference: z.string().optional().nullable(),
});

export const updateFinancialStatementSchema = z.object({
  type: z.enum(financialStatementTypeValues).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  fiscalYear: z.number().int().min(1900).max(2100).optional(),
  periodType: z.enum(periodTypeValues).optional(),
  currency: z.string().length(3).optional(),
  scale: z.enum(scaleValues).optional(),
  sourceType: z.enum(dataSourceTypeValues).optional().nullable(),
  sourceReference: z.string().optional().nullable(),
});

export type CreateFinancialStatementFormData = z.infer<typeof createFinancialStatementSchema>;
export type UpdateFinancialStatementFormData = z.infer<typeof updateFinancialStatementSchema>;
