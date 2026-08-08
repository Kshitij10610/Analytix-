import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, companyMembersApi } from "@/services/api/companies";
import type { Company, CreateCompanyPayload, UpdateCompanyPayload } from "@/features/companies/types/company";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await companiesApi.findAll();
      const data = response.data;
      if (Array.isArray(data)) return data;
      return [];
    },
  });
}

export function useCompany(companyId: string) {
  return useQuery({
    queryKey: ["companies", companyId],
    queryFn: async () => {
      const response = await companiesApi.findOne(companyId);
      return response.data as Company;
    },
    enabled: !!companyId,
  });
}

export function useCompanyMembers(companyId: string) {
  return useQuery({
    queryKey: ["companies", companyId, "members"],
    queryFn: async () => {
      const response = await companyMembersApi.list(companyId);
      return response.data ?? [];
    },
    enabled: !!companyId,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyPayload) => companiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyPayload }) =>
      companiesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companies", variables.id] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
