import { apiClient } from "@/lib/api/client";
import type {
  FinancialStatement,
  FinancialStatementWithLineItems,
  CreateFinancialStatementPayload,
  UpdateFinancialStatementPayload,
} from "@/features/financials/types/financial-statement";

export const financialsApi = {
  findByCompany: (companyId: string) =>
    apiClient.get<FinancialStatement[]>(`/companies/${companyId}/financial-statements`),

  findOne: (id: string) =>
    apiClient.get<FinancialStatement>(`/financial-statements/${id}`),

  findOneWithLineItems: (id: string) =>
    apiClient.get<FinancialStatementWithLineItems>(`/financial-statements/${id}/line-items/view`),

  create: (companyId: string, data: CreateFinancialStatementPayload) =>
    apiClient.post<FinancialStatement>(`/companies/${companyId}/financial-statements/simple`, data),

  createWithLineItems: (companyId: string, data: CreateFinancialStatementPayload & { lineItems: unknown[] }) =>
    apiClient.post<FinancialStatement>(`/companies/${companyId}/financial-statements`, data),

  update: (id: string, data: UpdateFinancialStatementPayload) =>
    apiClient.patch<FinancialStatement>(`/financial-statements/${id}`, data),

  remove: (id: string) =>
    apiClient.delete<void>(`/financial-statements/${id}`),
};

