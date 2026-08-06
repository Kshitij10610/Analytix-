-- Add composite unique constraint on import_jobs for composite FK from ImportRawRow
CREATE UNIQUE INDEX IF NOT EXISTS "import_jobs_company_id_unique" ON "import_jobs" ("companyId", "id");

-- Add import_raw_rows table
CREATE TABLE "import_raw_rows" (
  id TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "sheetName" TEXT NOT NULL,
  "sheetIndex" INTEGER NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "values" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "import_raw_rows_job_row_unique" ON "import_raw_rows" ("companyId", "importJobId", "sheetIndex", "rowNumber");
CREATE INDEX IF NOT EXISTS "import_raw_rows_company_job_idx" ON "import_raw_rows" ("companyId", "importJobId");

-- Add composite FK from import_raw_rows to import_jobs via (companyId, importJobId)
ALTER TABLE "import_raw_rows" ADD CONSTRAINT "import_raw_rows_companyId_importJobId_fkey"
  FOREIGN KEY ("companyId", "importJobId")
  REFERENCES "import_jobs" ("companyId", "id")
  ON DELETE CASCADE;
