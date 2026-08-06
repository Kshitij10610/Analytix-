CREATE UNIQUE INDEX "source_files_company_id_unique" ON "source_files" ("companyId", id);

ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_sourceFileId_fkey";

ALTER TABLE "import_jobs" ADD FOREIGN KEY ("companyId", "sourceFileId") REFERENCES "source_files"("companyId", id) ON DELETE RESTRICT;

CREATE INDEX "import_jobs_company_sourceFileId_idx" ON "import_jobs" ("companyId", "sourceFileId");
