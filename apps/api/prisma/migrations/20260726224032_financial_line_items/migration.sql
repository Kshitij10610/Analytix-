CREATE TABLE "metric_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statementType" "FinancialStatementType" NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- Unique code per statement type
CREATE UNIQUE INDEX "metric_definitions_code_statementType_key"
  ON "metric_definitions"("code", "statementType");

-- Enforce stable codes
ALTER TABLE "metric_definitions"
  ADD CONSTRAINT "metric_definitions_code_format"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');

CREATE TABLE "financial_line_items" (
    "id" TEXT NOT NULL,
    "financialStatementId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "value" NUMERIC(30,6) NOT NULL,
    "labelOverride" TEXT,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_line_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_line_items_financialStatementId_metricDefinitionId_key"
  ON "financial_line_items"("financialStatementId", "metricDefinitionId");

CREATE INDEX "financial_line_items_financialStatementId_idx"
  ON "financial_line_items"("financialStatementId");

CREATE INDEX "financial_line_items_metricDefinitionId_idx"
  ON "financial_line_items"("metricDefinitionId");

ALTER TABLE "financial_line_items"
  ADD CONSTRAINT "financial_line_items_financialStatementId_fkey"
  FOREIGN KEY ("financialStatementId") REFERENCES "financial_statements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_line_items"
  ADD CONSTRAINT "financial_line_items_metricDefinitionId_fkey"
  FOREIGN KEY ("metricDefinitionId") REFERENCES "metric_definitions"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
