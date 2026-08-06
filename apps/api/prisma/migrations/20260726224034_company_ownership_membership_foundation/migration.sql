-- company_ownership_membership_foundation: Add company ownership and membership support

-- 1. Create the company member role enum
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- 2. Add ownerId to companies (nullable initially)
ALTER TABLE "companies" 
  ADD COLUMN "ownerId" TEXT;

-- 3. Create the company_members table
CREATE TABLE "company_members" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role" "CompanyMemberRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  
  CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- 4. Create indexes
CREATE INDEX "company_members_userId_idx" ON "company_members" ("userId");
CREATE INDEX "company_members_companyId_idx" ON "company_members" ("companyId");

-- 5. Create unique constraint
CREATE UNIQUE INDEX "company_members_userId_companyId_key" ON "company_members" ("userId", "companyId");

-- 6. Add foreign key for ownerId (SET NULL on user delete)
ALTER TABLE "companies" 
  ADD CONSTRAINT "companies_ownerId_fkey" 
  FOREIGN KEY ("ownerId") 
  REFERENCES "users" ("id") 
  ON DELETE SET NULL;

-- 7. Add foreign key for company_members.userId (CASCADE on user delete)
ALTER TABLE "company_members" 
  ADD CONSTRAINT "company_members_userId_fkey" 
  FOREIGN KEY ("userId") 
  REFERENCES "users" ("id") 
  ON DELETE CASCADE;

-- 8. Add foreign key for company_members.companyId (CASCADE on company delete)
ALTER TABLE "company_members" 
  ADD CONSTRAINT "company_members_companyId_fkey" 
  FOREIGN KEY ("companyId") 
  REFERENCES "companies" ("id") 
  ON DELETE CASCADE;

-- 9. Remove the old implicit join table (confirmed empty)
DROP TABLE IF EXISTS "_CompanyToUser";
