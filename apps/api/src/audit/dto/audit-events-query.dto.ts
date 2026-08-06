export class AuditEventsQueryDto {
  action?: string;
  resourceType?: string;
  actorUserId?: string;
  result?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}
