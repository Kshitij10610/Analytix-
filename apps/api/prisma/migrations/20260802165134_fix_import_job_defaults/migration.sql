-- fix_import_job_defaults

-- 1. id column: Prisma @default(cuid()) is a client-side default.
--    No database-level change is required; Prisma Client will now
--    auto-generate a UUID before INSERT.

-- 2. statementType column: Was supposed to be made nullable by
--    migration 20260730230200_import_job_statement_type_nullable,
--    but that migration was never actually applied to the database.
--    This migration applies the ALTER TABLE to make it nullable.
--    Without this, any tx.importJob.create({ statementType: null })
--    will fail with P2011 (null constraint violation).

ALTER TABLE "import_jobs" ALTER COLUMN "statementType" DROP NOT NULL;
