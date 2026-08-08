import { apiClient } from "@/lib/api/client";

export const auditApi = {
  findByCompany: (companyId: string, params?: Record<string, unknown>) =>
    apiClient.get(`/companies/${companyId}/audit-events`, { params }),
};
