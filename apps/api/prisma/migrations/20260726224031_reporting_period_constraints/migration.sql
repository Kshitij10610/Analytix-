-- reporting_period_constraints: Replace Prisma-managed unique index (which treats NULL as distinct)
-- with partial unique indexes and CHECK constraints that enforce reporting-period semantics.

-- Drop the Prisma-generated unique index from the prior migration.
-- On a fresh DB this index exists; on the local DB it was already removed in step 7B.2F.
DROP INDEX IF EXISTS "financial_statements_companyId_type_fiscalYear_fiscalQuarter_periodType_key";

-- ANNUAL: one statement per company+type+fiscalYear (fiscalQuarter must be NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "financial_statements_annual_unique"
  ON "financial_statements"("companyId", type, "fiscalYear", "periodType")
  WHERE ("periodType" = 'ANNUAL'::"FinancialPeriodType" AND "fiscalQuarter" IS NULL);

-- QUARTERLY: one statement per company+type+fiscalYear+fiscalQuarter (fiscalQuarter must be 1-4)
CREATE UNIQUE INDEX IF NOT EXISTS "financial_statements_quarterly_unique"
  ON "financial_statements"("companyId", type, "fiscalYear", "fiscalQuarter", "periodType")
  WHERE ("periodType" = 'QUARTERLY'::"FinancialPeriodType" AND "fiscalQuarter" IS NOT NULL);

-- TTM: one statement per company+type+periodStart+periodEnd (fiscalQuarter must be NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "financial_statements_ttm_unique"
  ON "financial_statements"("companyId", type, "periodStart", "periodEnd", "periodType")
  WHERE ("periodType" = 'TTM'::"FinancialPeriodType" AND "fiscalQuarter" IS NULL);

-- CHECK: periodEnd must be after periodStart
ALTER TABLE "financial_statements"
  ADD CONSTRAINT "check_period_dates"
  CHECK ("periodEnd" > "periodStart");

-- CHECK: QUARTERLY requires fiscalQuarter 1-4
ALTER TABLE "financial_statements"
  ADD CONSTRAINT "check_quarterly_quarter"
  CHECK (
    ("periodType" <> 'QUARTERLY'::"FinancialPeriodType")
    OR ("fiscalQuarter" IS NOT NULL AND "fiscalQuarter" BETWEEN 1 AND 4)
  );

-- CHECK: ANNUAL requires fiscalQuarter is NULL
ALTER TABLE "financial_statements"
  ADD CONSTRAINT "check_annual_no_quarter"
  CHECK (
    ("periodType" <> 'ANNUAL'::"FinancialPeriodType")
    OR ("fiscalQuarter" IS NULL)
  );

-- CHECK: TTM requires fiscalQuarter is NULL
ALTER TABLE "financial_statements"
  ADD CONSTRAINT "check_ttm_no_quarter"
  CHECK (
    ("periodType" <> 'TTM'::"FinancialPeriodType")
    OR ("fiscalQuarter" IS NULL)
  );
