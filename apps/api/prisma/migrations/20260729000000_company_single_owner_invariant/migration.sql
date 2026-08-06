-- company_single_owner_invariant: enforce at most one OWNER membership per company

-- Partial unique index: only one CompanyMember with role OWNER per company.
-- Multiple EDITOR and VIEWER memberships remain allowed.
-- Company.ownerId synchronization remains application-enforced.
CREATE UNIQUE INDEX company_members_single_owner_unique
ON "company_members" ("companyId")
WHERE role = 'OWNER';
