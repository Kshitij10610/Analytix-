CREATE TYPE "SourceFileStatus" AS ENUM ('UPLOADED', 'FAILED');
CREATE TYPE "ImportJobStatus" AS ENUM (
  'UPLOADED',
  'PARSED',
  'NEEDS_MAPPING',
  'MAPPED',
  'VALIDATED',
  'READY',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "source_files" (
  id TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "mimeType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "status" "SourceFileStatus" NOT NULL DEFAULT 'UPLOADED',
  "metadata" JSONB
);

CREATE TABLE "import_jobs" (
  id TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "sourceFileId" TEXT NOT NULL,
  "statementType" "FinancialStatementType" NOT NULL,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
  "mapping" JSONB,
  "parseSummary" JSONB,
  "validationErrors" JSONB,
  "lastCommitError" JSONB,
  "committedStatementId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ
);

CREATE UNIQUE INDEX "source_files_company_sha_unique" ON "source_files" ("companyId", sha256);
CREATE INDEX "source_files_company_uploadedAt_idx" ON "source_files" ("companyId", "uploadedAt");
CREATE INDEX "source_files_sha256_idx" ON "source_files" ("sha256");
CREATE INDEX "source_files_status_idx" ON "source_files" ("status");

CREATE INDEX "import_jobs_company_status_createdAt_idx" ON "import_jobs" ("companyId", "status", "createdAt");
CREATE INDEX "import_jobs_sourceFileId_idx" ON "import_jobs" ("sourceFileId");
CREATE INDEX "import_jobs_committedStatementId_idx" ON "import_jobs" ("committedStatementId");

ALTER TABLE "source_files" ADD FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE;
ALTER TABLE "import_jobs" ADD FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE;
ALTER TABLE "import_jobs" ADD FOREIGN KEY ("sourceFileId") REFERENCES "source_files"("id") ON DELETE RESTRICT;
