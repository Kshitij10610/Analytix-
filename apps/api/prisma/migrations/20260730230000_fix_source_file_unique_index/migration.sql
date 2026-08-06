DROP INDEX IF EXISTS "source_files_company_sha_unique";

CREATE UNIQUE INDEX "source_files_company_sha_unique"
ON "source_files" ("companyId", sha256);
