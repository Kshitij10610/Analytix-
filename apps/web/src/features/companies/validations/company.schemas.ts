import { z } from "zod";

export const createCompanySchema = z.object({
  name: z
    .string()
    .min(1, "Company name is required")
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be less than 100 characters"),
  industry: z
    .string()
    .max(100, "Industry must be less than 100 characters")
    .optional()
    .default(""),
  website: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .default(""),
});

export type CreateCompanyFormData = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z.object({
  name: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be less than 100 characters")
    .optional(),
  industry: z
    .string()
    .max(100, "Industry must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type UpdateCompanyFormData = z.infer<typeof updateCompanySchema>;
