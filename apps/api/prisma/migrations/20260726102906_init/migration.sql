-- CreateEnum
CREATE TYPE "FinancialStatementType" AS ENUM ('INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_statements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "FinancialStatementType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CompanyToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CompanyToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "financial_statements_companyId_type_periodStart_periodEnd_key" ON "financial_statements"("companyId", "type", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "_CompanyToUser_B_index" ON "_CompanyToUser"("B");

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToUser" ADD CONSTRAINT "_CompanyToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToUser" ADD CONSTRAINT "_CompanyToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
