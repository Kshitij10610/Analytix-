import { useQuery } from "@tanstack/react-query";
import { financialsApi } from "@/services/api/financials";
import type { FinancialStatementWithLineItems, FinancialStatement } from "@/features/financials/types/financial-statement";

export function useCompanyFinancialStatements(companyId: string) {
  return useQuery({
    queryKey: ["companies", companyId, "financial-statements"],
    queryFn: async () => {
      const response = await financialsApi.findByCompany(companyId);
      return response.data as FinancialStatement[];
    },
    enabled: !!companyId,
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

export function useDashboardData(companyId: string) {
  return useQuery({
    queryKey: ["companies", companyId, "dashboard"],
    queryFn: async () => {
      const response = await financialsApi.findByCompany(companyId);
      const statements = (response.data as FinancialStatement[]) ?? [];

      const statementsWithLineItems = await Promise.all(
        statements.map(async (stmt) => {
          const detail = await financialsApi.findOneWithLineItems(stmt.id);
          return detail.data as FinancialStatementWithLineItems;
        })
      );

      return statementsWithLineItems;
    },
    enabled: !!companyId,
  });
}

export function useMultiYearComparison(companyId: string, years: number[]) {
  return useQuery({
    queryKey: ["companies", companyId, "multi-year", years.sort().join(",")],
    queryFn: async () => {
      const response = await financialsApi.findByCompany(companyId);
      const statements = (response.data as FinancialStatement[]) ?? [];

      const selectedStatements = statements.filter((s) => years.includes(s.fiscalYear));

      const statementsWithLineItems = await Promise.all(
        selectedStatements.map(async (stmt) => {
          const detail = await financialsApi.findOneWithLineItems(stmt.id);
          return detail.data as FinancialStatementWithLineItems;
        })
      );

      return statementsWithLineItems;
    },
    enabled: !!companyId && years.length > 0,
  });
}
