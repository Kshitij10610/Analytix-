import { apiClient } from "@/lib/api/client";
import type { Company, CompanyMember, CreateCompanyPayload, UpdateCompanyPayload } from "@/features/companies/types/company";

export const companiesApi = {
  findAll: () => apiClient.get<Company[]>("/companies"),
  findOne: (id: string) => apiClient.get<Company>(`/companies/${id}`),
  create: (data: CreateCompanyPayload) => apiClient.post<Company>("/companies", data),
  update: (id: string, data: UpdateCompanyPayload) => apiClient.patch<Company>(`/companies/${id}`, data),
  remove: (id: string) => apiClient.delete<void>(`/companies/${id}`),
};

export const companyMembersApi = {
  list: (companyId: string) => apiClient.get<CompanyMember[]>(`/companies/${companyId}/members`),
};
