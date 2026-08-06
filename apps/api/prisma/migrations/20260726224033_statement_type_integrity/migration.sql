-- statement_type_integrity: Enforce FinancialLineItem.statementType matches both
-- FinancialStatement.type and MetricDefinition.statementType via composite FKs.

-- 1. Add statementType column (nullable initially for safe backfill)
ALTER TABLE "financial_line_items"
  ADD COLUMN IF NOT EXISTS "statementType" "FinancialStatementType";

-- 2. Backfill statementType from authoritative parent FinancialStatement
UPDATE "financial_line_items" fli
SET "statementType" = fs.type
FROM "financial_statements" fs
WHERE fli."financialStatementId" = fs.id
  AND fli."statementType" IS NULL;

-- 3. Make statementType NOT NULL
ALTER TABLE "financial_line_items"
  ALTER COLUMN "statementType" SET NOT NULL;

-- 4. Ensure parent tables have composite unique targets for the new FKs
CREATE UNIQUE INDEX IF NOT EXISTS "financial_statements_id_type_key"
  ON "financial_statements"("id", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "metric_definitions_id_statementType_key"
  ON "metric_definitions"("id", "statementType");

-- 5. Drop old single-column FKs
ALTER TABLE "financial_line_items"
  DROP CONSTRAINT IF EXISTS "financial_line_items_financialStatementId_fkey";

ALTER TABLE "financial_line_items"
  DROP CONSTRAINT IF EXISTS "financial_line_items_metricDefinitionId_fkey";

-- 6. Create composite FKs that enforce statementType compatibility
ALTER TABLE "financial_line_items"
  ADD CONSTRAINT "financial_line_items_statement_fkey"
  FOREIGN KEY ("financialStatementId", "statementType")
  REFERENCES "financial_statements"("id", "type")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_line_items"
  ADD CONSTRAINT "financial_line_items_metric_fkey"
  FOREIGN KEY ("metricDefinitionId", "statementType")
  REFERENCES "metric_definitions"("id", "statementType")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
