import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit.constants';

export interface AuditActorResponse {
  type: AuditActorType;
  userId?: string;
  email?: string;
  globalRole?: string;
}

export interface AuditResourceResponse {
  type: AuditResourceType;
  id?: string;
}

export interface AuditEventResponse {
  id: string;
  occurredAt: Date;
  actor: AuditActorResponse;
  action: AuditAction;
  resource: AuditResourceResponse;
  result: AuditResult;
  failureReason?: string;
  changes?: unknown;
  metadata?: unknown;
  requestId?: string;
}

export interface AuditEventsPage {
  events: AuditEventResponse[];
  nextCursor: string | null;
}
