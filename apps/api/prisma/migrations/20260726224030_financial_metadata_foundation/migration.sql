-- CreateEnum
CREATE TYPE "FinancialPeriodType" AS ENUM ('ANNUAL', 'QUARTERLY', 'TTM');

-- CreateEnum
CREATE TYPE "FinancialScale" AS ENUM ('ONES', 'THOUSANDS', 'MILLIONS', 'BILLIONS');

-- CreateEnum
CREATE TYPE "FinancialDataSourceType" AS ENUM ('MANUAL', 'CSV_IMPORT', 'API', 'AI_EXTRACTED');

-- AlterTable
ALTER TABLE "financial_statements" ADD COLUMN     "fiscalYear" INTEGER NOT NULL,
ADD COLUMN     "fiscalQuarter" INTEGER,
ADD COLUMN     "periodType" "FinancialPeriodType" NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "scale" "FinancialScale" NOT NULL,
ADD COLUMN     "sourceType" "FinancialDataSourceType",
ADD COLUMN     "sourceReference" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedBy" TEXT;

-- DropIndex
DROP INDEX "financial_statements_companyId_type_periodStart_periodEnd_key";

-- CreateIndex
CREATE UNIQUE INDEX "financial_statements_companyId_type_fiscalYear_fiscalQuarter_periodType_key" ON "financial_statements"("companyId", "type", "fiscalYear", "fiscalQuarter", "periodType");

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
