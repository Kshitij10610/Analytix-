import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { financialsApi } from "@/services/api/financials";
import type {
  FinancialStatement,
  FinancialStatementWithLineItems,
  CreateFinancialStatementPayload,
  UpdateFinancialStatementPayload,
} from "@/features/financials/types/financial-statement";

export function useFinancialStatements(companyId: string) {
  return useQuery({
    queryKey: ["companies", companyId, "financial-statements"],
    queryFn: async () => {
      const response = await financialsApi.findByCompany(companyId);
      return response.data ?? [];
    },
    enabled: !!companyId,
  });
}

export function useFinancialStatement(statementId: string) {
  return useQuery({
    queryKey: ["financial-statements", statementId],
    queryFn: async () => {
      const response = await financialsApi.findOne(statementId);
      return response.data as FinancialStatement;
    },
    enabled: !!statementId,
  });
}

export function useFinancialStatementWithLineItems(statementId: string) {
  return useQuery({
    queryKey: ["financial-statements", statementId, "line-items"],
    queryFn: async () => {
      const response = await financialsApi.findOneWithLineItems(statementId);
      return response.data as FinancialStatementWithLineItems;
    },
    enabled: !!statementId,
  });
}

export function useCreateFinancialStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: CreateFinancialStatementPayload }) =>
      financialsApi.create(companyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["companies", variables.companyId, "financial-statements"] });
    },
  });
}

export function useUpdateFinancialStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFinancialStatementPayload }) =>
      financialsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-statements"] });
    },
  });
}

export function useDeleteFinancialStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financialsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-statements"] });
    },
  });
}
