BEGIN;

ALTER TABLE "import_jobs" ADD COLUMN "periodStart" TIMESTAMPTZ(6);
ALTER TABLE "import_jobs" ADD COLUMN "periodEnd" TIMESTAMPTZ(6);
ALTER TABLE "import_jobs" ADD COLUMN "fiscalYear" INTEGER;
ALTER TABLE "import_jobs" ADD COLUMN "periodType" "FinancialPeriodType";
ALTER TABLE "import_jobs" ADD COLUMN "currency" VARCHAR(100);
ALTER TABLE "import_jobs" ADD COLUMN "scale" "FinancialScale";
ALTER TABLE "import_jobs" ADD COLUMN "normalizedAt" TIMESTAMPTZ(6);

COMMIT;
