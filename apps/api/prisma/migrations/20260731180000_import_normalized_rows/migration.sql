BEGIN;

CREATE TABLE "import_normalized_rows" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "statementType" TEXT NOT NULL,
    "sheetIndex" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceIndex" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_normalized_rows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "import_normalized_rows"
    ADD CONSTRAINT "import_normalized_rows_import_job_fkey"
    FOREIGN KEY ("companyId", "importJobId")
    REFERENCES "import_jobs" ("companyId", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "import_normalized_rows"
    ADD CONSTRAINT "import_normalized_rows_metric_definition_fkey"
    FOREIGN KEY ("metricDefinitionId")
    REFERENCES "metric_definitions" ("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "import_normalized_rows_company_job_metric_unique"
    ON "import_normalized_rows" ("companyId", "importJobId", "metricDefinitionId");

CREATE INDEX "import_normalized_rows_company_job_idx"
    ON "import_normalized_rows" ("companyId", "importJobId");

CREATE INDEX "import_normalized_rows_metric_def_idx"
    ON "import_normalized_rows" ("metricDefinitionId");

COMMIT;
