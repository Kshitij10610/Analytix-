CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "AuditAction" AS ENUM (
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGOUT',
  'AUTH_REFRESH_SUCCESS',
  'AUTH_REFRESH_FAILURE',
  'COMPANY_CREATE',
  'COMPANY_UPDATE',
  'COMPANY_DELETE',
  'MEMBER_ADD',
  'MEMBER_ROLE_UPDATE',
  'MEMBER_REMOVE',
  'MEMBER_SELF_LEAVE',
  'OWNERSHIP_TRANSFER',
  'FINANCIAL_STATEMENT_CREATE',
  'FINANCIAL_STATEMENT_UPDATE',
  'FINANCIAL_STATEMENT_DELETE',
  'LINE_ITEM_CREATE',
  'LINE_ITEM_UPDATE',
  'LINE_ITEM_DELETE',
  'LINE_ITEMS_REPLACE'
);
CREATE TYPE "AuditResourceType" AS ENUM (
  'USER',
  'COMPANY',
  'COMPANY_MEMBER',
  'FINANCIAL_STATEMENT',
  'FINANCIAL_LINE_ITEM',
  'AUTH_SESSION'
);
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');
CREATE TABLE "audit_events" (
  id TEXT NOT NULL PRIMARY KEY,
  "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actorType" "AuditActorType" NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "actorGlobalRole" TEXT,
  "companyId" TEXT,
  "action" "AuditAction" NOT NULL,
  "resourceType" "AuditResourceType" NOT NULL,
  "resourceId" TEXT,
  "result" "AuditResult" NOT NULL,
  "failureReason" TEXT,
  "changes" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "audit_events_companyId_occurredAt_idx" ON "audit_events" ("companyId", "occurredAt");
CREATE INDEX "audit_events_actorUserId_occurredAt_idx" ON "audit_events" ("actorUserId", "occurredAt");
CREATE INDEX "audit_events_resourceType_resourceId_idx" ON "audit_events" ("resourceType", "resourceId");
CREATE INDEX "audit_events_action_occurredAt_idx" ON "audit_events" ("action", "occurredAt");
CREATE INDEX "audit_events_occurredAt_idx" ON "audit_events" ("occurredAt");
