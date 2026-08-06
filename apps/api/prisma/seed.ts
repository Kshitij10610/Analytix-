import { PrismaClient } from '../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { FinancialStatementType } from '../src/generated/enums';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type StandardMetric = {
  code: string;
  statementType: FinancialStatementType;
  label: string;
  category: string;
  description?: string;
  displayOrder: number;
};

const METRICS: StandardMetric[] = [
  { code: 'REVENUE', statementType: 'INCOME_STATEMENT', label: 'Revenue', category: 'Revenue', displayOrder: 10 },
  { code: 'COST_OF_REVENUE', statementType: 'INCOME_STATEMENT', label: 'Cost of Revenue', category: 'Revenue', displayOrder: 20 },
  { code: 'GROSS_PROFIT', statementType: 'INCOME_STATEMENT', label: 'Gross Profit', category: 'Profitability', displayOrder: 30 },
  { code: 'OPERATING_EXPENSES', statementType: 'INCOME_STATEMENT', label: 'Operating Expenses', category: 'Operating Expenses', displayOrder: 40 },
  { code: 'SELLING_GENERAL_ADMINISTRATIVE', statementType: 'INCOME_STATEMENT', label: 'Selling, General and Administrative', category: 'Operating Expenses', displayOrder: 50 },
  { code: 'RESEARCH_DEVELOPMENT', statementType: 'INCOME_STATEMENT', label: 'Research and Development', category: 'Operating Expenses', displayOrder: 60 },
  { code: 'DEPRECIATION_AMORTIZATION', statementType: 'INCOME_STATEMENT', label: 'Depreciation and Amortization', category: 'Operating Expenses', displayOrder: 70 },
  { code: 'OPERATING_INCOME', statementType: 'INCOME_STATEMENT', label: 'Operating Income', category: 'Profitability', displayOrder: 80 },
  { code: 'EBIT', statementType: 'INCOME_STATEMENT', label: 'EBIT', category: 'Profitability', displayOrder: 90 },
  { code: 'INTEREST_EXPENSE', statementType: 'INCOME_STATEMENT', label: 'Interest Expense', category: 'Non-Operating', displayOrder: 100 },
  { code: 'INTEREST_INCOME', statementType: 'INCOME_STATEMENT', label: 'Interest Income', category: 'Non-Operating', displayOrder: 110 },
  { code: 'OTHER_INCOME_EXPENSE', statementType: 'INCOME_STATEMENT', label: 'Other Income / Expense', category: 'Non-Operating', displayOrder: 120 },
  { code: 'INCOME_BEFORE_TAX', statementType: 'INCOME_STATEMENT', label: 'Income Before Tax', category: 'Profitability', displayOrder: 130 },
  { code: 'INCOME_TAX_EXPENSE', statementType: 'INCOME_STATEMENT', label: 'Income Tax Expense', category: 'Taxes', displayOrder: 140 },
  { code: 'NET_INCOME', statementType: 'INCOME_STATEMENT', label: 'Net Income', category: 'Profitability', displayOrder: 150 },
  { code: 'CASH_AND_CASH_EQUIVALENTS', statementType: 'BALANCE_SHEET', label: 'Cash and Cash Equivalents', category: 'Assets', displayOrder: 10 },
  { code: 'SHORT_TERM_INVESTMENTS', statementType: 'BALANCE_SHEET', label: 'Short-Term Investments', category: 'Assets', displayOrder: 20 },
  { code: 'ACCOUNTS_RECEIVABLE', statementType: 'BALANCE_SHEET', label: 'Accounts Receivable', category: 'Assets', displayOrder: 30 },
  { code: 'INVENTORY', statementType: 'BALANCE_SHEET', label: 'Inventory', category: 'Assets', displayOrder: 40 },
  { code: 'CURRENT_ASSETS', statementType: 'BALANCE_SHEET', label: 'Current Assets', category: 'Assets', displayOrder: 50 },
  { code: 'PROPERTY_PLANT_EQUIPMENT', statementType: 'BALANCE_SHEET', label: 'Property, Plant and Equipment', category: 'Assets', displayOrder: 60 },
  { code: 'GOODWILL', statementType: 'BALANCE_SHEET', label: 'Goodwill', category: 'Assets', displayOrder: 70 },
  { code: 'INTANGIBLE_ASSETS', statementType: 'BALANCE_SHEET', label: 'Intangible Assets', category: 'Assets', displayOrder: 80 },
  { code: 'TOTAL_ASSETS', statementType: 'BALANCE_SHEET', label: 'Total Assets', category: 'Assets', displayOrder: 90 },
  { code: 'ACCOUNTS_PAYABLE', statementType: 'BALANCE_SHEET', label: 'Accounts Payable', category: 'Liabilities', displayOrder: 100 },
  { code: 'SHORT_TERM_DEBT', statementType: 'BALANCE_SHEET', label: 'Short-Term Debt', category: 'Liabilities', displayOrder: 110 },
  { code: 'CURRENT_LIABILITIES', statementType: 'BALANCE_SHEET', label: 'Current Liabilities', category: 'Liabilities', displayOrder: 120 },
  { code: 'LONG_TERM_DEBT', statementType: 'BALANCE_SHEET', label: 'Long-Term Debt', category: 'Liabilities', displayOrder: 130 },
  { code: 'TOTAL_DEBT', statementType: 'BALANCE_SHEET', label: 'Total Debt', category: 'Liabilities', displayOrder: 140 },
  { code: 'TOTAL_LIABILITIES', statementType: 'BALANCE_SHEET', label: 'Total Liabilities', category: 'Liabilities', displayOrder: 150 },
  { code: 'SHARE_CAPITAL', statementType: 'BALANCE_SHEET', label: 'Share Capital', category: 'Equity', displayOrder: 160 },
  { code: 'RETAINED_EARNINGS', statementType: 'BALANCE_SHEET', label: 'Retained Earnings', category: 'Equity', displayOrder: 170 },
  { code: 'TOTAL_EQUITY', statementType: 'BALANCE_SHEET', label: 'Total Equity', category: 'Equity', displayOrder: 180 },
  { code: 'NET_INCOME', statementType: 'CASH_FLOW', label: 'Net Income', category: 'Operating', displayOrder: 10 },
  { code: 'DEPRECIATION_AMORTIZATION', statementType: 'CASH_FLOW', label: 'Depreciation and Amortization', category: 'Operating', displayOrder: 20 },
  { code: 'STOCK_BASED_COMPENSATION', statementType: 'CASH_FLOW', label: 'Stock-Based Compensation', category: 'Operating', displayOrder: 30 },
  { code: 'CHANGE_IN_WORKING_CAPITAL', statementType: 'CASH_FLOW', label: 'Change in Working Capital', category: 'Operating', displayOrder: 40 },
  { code: 'OPERATING_CASH_FLOW', statementType: 'CASH_FLOW', label: 'Operating Cash Flow', category: 'Operating', displayOrder: 50 },
  { code: 'CAPITAL_EXPENDITURES', statementType: 'CASH_FLOW', label: 'Capital Expenditures', category: 'Investing', displayOrder: 60 },
  { code: 'ACQUISITIONS', statementType: 'CASH_FLOW', label: 'Acquisitions', category: 'Investing', displayOrder: 70 },
  { code: 'INVESTING_CASH_FLOW', statementType: 'CASH_FLOW', label: 'Investing Cash Flow', category: 'Investing', displayOrder: 80 },
  { code: 'DEBT_ISSUED', statementType: 'CASH_FLOW', label: 'Debt Issued', category: 'Financing', displayOrder: 90 },
  { code: 'DEBT_REPAID', statementType: 'CASH_FLOW', label: 'Debt Repaid', category: 'Financing', displayOrder: 100 },
  { code: 'DIVIDENDS_PAID', statementType: 'CASH_FLOW', label: 'Dividends Paid', category: 'Financing', displayOrder: 110 },
  { code: 'SHARE_REPURCHASES', statementType: 'CASH_FLOW', label: 'Share Repurchases', category: 'Financing', displayOrder: 120 },
  { code: 'FINANCING_CASH_FLOW', statementType: 'CASH_FLOW', label: 'Financing Cash Flow', category: 'Financing', displayOrder: 130 },
  { code: 'NET_CHANGE_IN_CASH', statementType: 'CASH_FLOW', label: 'Net Change in Cash', category: 'Summary', displayOrder: 140 },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const metric of METRICS) {
    try {
      await prisma.metricDefinition.create({
        data: {
          code: metric.code,
          statementType: metric.statementType,
          label: metric.label,
          category: metric.category,
          description: metric.description,
          isStandard: true,
          displayOrder: metric.displayOrder,
        },
      });
      created++;
    } catch (error) {
      const code = (error as unknown as { code?: string }).code;
      if (code === 'P2002') {
        skipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`Seed complete: created=${created} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error('Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
