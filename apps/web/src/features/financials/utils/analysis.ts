import type { FinancialStatementWithLineItems, TrendPoint, RatioResult } from "@/features/financials/types/financial-statement";

export function getLineItemValue(statement: FinancialStatementWithLineItems, code: string): number {
  const item = statement.lineItems.find((li) => li.metricCode === code);
  if (!item) return 0;
  const parsed = parseFloat(item.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeRatios(statement: FinancialStatementWithLineItems): RatioResult[] {
  const revenue = getLineItemValue(statement, "REVENUE");
  const costOfRevenue = getLineItemValue(statement, "COST_OF_REVENUE");
  const grossProfit = getLineItemValue(statement, "GROSS_PROFIT");
  const operatingIncome = getLineItemValue(statement, "OPERATING_INCOME");
  const netIncome = getLineItemValue(statement, "NET_INCOME");
  const totalAssets = getLineItemValue(statement, "TOTAL_ASSETS");
  const totalLiabilities = getLineItemValue(statement, "TOTAL_LIABILITIES");
  const totalEquity = getLineItemValue(statement, "TOTAL_EQUITY");
  const currentAssets = getLineItemValue(statement, "CURRENT_ASSETS");
  const currentLiabilities = getLineItemValue(statement, "CURRENT_LIABILITIES");
  const cash = getLineItemValue(statement, "CASH_AND_CASH_EQUIVALENTS");
  const shortTermInvestments = getLineItemValue(statement, "SHORT_TERM_INVESTMENTS");
  const inventory = getLineItemValue(statement, "INVENTORY");
  const accountsReceivable = getLineItemValue(statement, "ACCOUNTS_RECEIVABLE");
  const totalDebt = getLineItemValue(statement, "TOTAL_DEBT");
  const interestExpense = getLineItemValue(statement, "INTEREST_EXPENSE");
  const ebit = getLineItemValue(statement, "EBIT");

  const ratios: RatioResult[] = [];

  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : null;
  const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : null;
  const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : null;

  ratios.push({ name: "Gross Margin", value: grossMargin, format: "percent", description: "Gross Profit / Revenue" });
  ratios.push({ name: "Operating Margin", value: operatingMargin, format: "percent", description: "Operating Income / Revenue" });
  ratios.push({ name: "Net Margin", value: netMargin, format: "percent", description: "Net Income / Revenue" });

  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : null;
  const cashRatio = currentLiabilities > 0 ? (cash + shortTermInvestments) / currentLiabilities : null;

  ratios.push({ name: "Current Ratio", value: currentRatio, format: "ratio", description: "Current Assets / Current Liabilities" });
  ratios.push({ name: "Quick Ratio", value: quickRatio, format: "ratio", description: "(Current Assets - Inventory) / Current Liabilities" });
  ratios.push({ name: "Cash Ratio", value: cashRatio, format: "ratio", description: "(Cash + Short-Term Investments) / Current Liabilities" });

  const debtToEquity = totalEquity > 0 ? totalDebt / totalEquity : null;
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : null;
  const interestCoverage = interestExpense > 0 ? ebit / interestExpense : null;

  ratios.push({ name: "Debt / Equity", value: debtToEquity, format: "ratio", description: "Total Debt / Total Equity" });
  ratios.push({ name: "Debt Ratio", value: debtRatio, format: "ratio", description: "Total Liabilities / Total Assets" });
  ratios.push({ name: "Interest Coverage", value: interestCoverage, format: "ratio", description: "EBIT / Interest Expense" });

  const roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : null;
  const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : null;

  ratios.push({ name: "ROE", value: roe, format: "percent", description: "Net Income / Total Equity" });
  ratios.push({ name: "ROA", value: roa, format: "percent", description: "Net Income / Total Assets" });

  const assetTurnover = totalAssets > 0 ? revenue / totalAssets : null;

  ratios.push({ name: "Asset Turnover", value: assetTurnover, format: "number", description: "Revenue / Total Assets" });

  const cogs = costOfRevenue || (revenue - grossProfit);
  const inventoryTurnover = inventory > 0 ? cogs / inventory : null;
  const receivableTurnover = accountsReceivable > 0 ? revenue / accountsReceivable : null;

  ratios.push({ name: "Inventory Turnover", value: inventoryTurnover, format: "number", description: "COGS / Inventory" });
  ratios.push({ name: "Receivable Turnover", value: receivableTurnover, format: "number", description: "Revenue / Accounts Receivable" });

  return ratios;
}

export function computeTrends(statements: FinancialStatementWithLineItems[], metricCode: string): TrendPoint[] {
  return statements
    .filter((s) => s.type !== "CASH_FLOW" || metricCode === "OPERATING_CASH_FLOW" || metricCode === "NET_CHANGE_IN_CASH")
    .map((s) => ({
      year: s.fiscalYear,
      value: getLineItemValue(s, metricCode),
      label: s.periodType === "ANNUAL" ? `FY${s.fiscalYear}` : `FY${s.fiscalYear} Q${s.fiscalQuarter || 1}`,
    }))
    .sort((a, b) => a.year - b.year);
}

export function getStatementTypeLabel(type: string): string {
  switch (type) {
    case "INCOME_STATEMENT":
      return "Income Statement";
    case "BALANCE_SHEET":
      return "Balance Sheet";
    case "CASH_FLOW":
      return "Cash Flow";
    default:
      return type;
  }
}

export function formatValue(value: number, format: RatioResult["format"]): string {
  switch (format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2) + "x";
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    case "number":
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
}

export function getTrendDirection(current: number, previous: number): "up" | "down" | "neutral" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "neutral";
}

export function getTrendColor(direction: "up" | "down" | "neutral", inverse: boolean = false): string {
  if (direction === "neutral") return "text-text-secondary";
  if (inverse) {
    return direction === "up" ? "text-error" : "text-success";
  }
  return direction === "up" ? "text-success" : "text-error";
}
