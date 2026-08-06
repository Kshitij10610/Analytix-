import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { $Enums } from '../generated/client';
import { TransactionClient } from '../generated/internal/prismaNamespace';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditActorType,
  AuditAction,
  AuditResourceType,
  AuditResult,
} from './audit.constants';
import { AuditActorResponse, AuditEventsPage, AuditEventResponse, AuditResourceResponse } from './dto/audit-event-response.dto';

export interface AuditEventData {
  actorType: AuditActorType;
  actorUserId?: string;
  actorEmail?: string;
  actorGlobalRole?: string;
  companyId?: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  result: AuditResult;
  failureReason?: string;
  changes?: unknown;
  metadata?: unknown;
  requestId?: string;
  occurredAt?: Date;
}

export interface ReadEventsParams {
  companyId: string;
  action?: string;
  resourceType?: string;
  actorUserId?: string;
  result?: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursorOccurredAt?: Date;
  cursorId?: string;
}

const SANITIZE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'password-hash',
  'accesstoken',
  'access_token',
  'access-token',
  'refreshtoken',
  'refresh_token',
  'refresh-token',
  'tokenhash',
  'token_hash',
  'token-hash',
  'jwtsecret',
  'jwt_secret',
  'jwt-secret',
  'secret',
  'databaseurl',
  'database_url',
  'database-url',
  'cookie',
  'cookies',
  'authorization',
  'credential',
  'credentials',
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SANITIZE_KEYS.has(normalized);
}

export function sanitizeAuditPayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeAuditPayload(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeAuditPayload(value);
    }
  }
  return sanitized;
}

function validateAuditData(data: AuditEventData): void {
  if (!data.action) {
    throw new InternalServerErrorException('Audit action is required');
  }
  if (!data.resourceType) {
    throw new InternalServerErrorException('Audit resourceType is required');
  }
  if (!data.result) {
    throw new InternalServerErrorException('Audit result is required');
  }

  if (data.actorType === AuditActorType.USER && !data.actorUserId) {
    throw new InternalServerErrorException('actorUserId is required for USER actorType');
  }
}

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async record(data: AuditEventData): Promise<{ id: string }> {
    validateAuditData(data);

    const sanitizedChanges = data.changes !== undefined ? sanitizeAuditPayload(data.changes) : undefined;
    const sanitizedMetadata = data.metadata !== undefined ? sanitizeAuditPayload(data.metadata) : undefined;

    try {
      const event = await this.prismaService.prisma.auditEvent.create({
        data: {
          actorType: data.actorType,
          actorUserId: data.actorUserId ?? null,
          actorEmail: data.actorEmail ?? null,
          actorGlobalRole: data.actorGlobalRole ?? null,
          companyId: data.companyId ?? null,
           action: data.action as $Enums.AuditAction,
           resourceType: data.resourceType as $Enums.AuditResourceType,
           resourceId: data.resourceId ?? null,
           result: data.result,
           failureReason: data.failureReason ?? null,
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           changes: sanitizedChanges as any,
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           metadata: sanitizedMetadata as any,
           requestId: data.requestId ?? null,
           occurredAt: data.occurredAt ?? new Date(),
         },
         select: { id: true },
       });
       return { id: event.id };
    } catch {
      throw new InternalServerErrorException('Failed to record audit event');
    }
  }

  async recordInTransaction(
    data: AuditEventData,
    tx: TransactionClient,
  ): Promise<{ id: string }> {
    validateAuditData(data);

    const sanitizedChanges = data.changes !== undefined ? sanitizeAuditPayload(data.changes) : undefined;
    const sanitizedMetadata = data.metadata !== undefined ? sanitizeAuditPayload(data.metadata) : undefined;

    try {
      const event = await tx.auditEvent.create({
        data: {
          actorType: data.actorType,
          actorUserId: data.actorUserId ?? null,
          actorEmail: data.actorEmail ?? null,
          actorGlobalRole: data.actorGlobalRole ?? null,
          companyId: data.companyId ?? null,
       action: data.action as $Enums.AuditAction,
       resourceType: data.resourceType as $Enums.AuditResourceType,
       resourceId: data.resourceId ?? null,
       result: data.result,
       failureReason: data.failureReason ?? null,
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       changes: sanitizedChanges as any,
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       metadata: sanitizedMetadata as any,
       requestId: data.requestId ?? null,
          occurredAt: data.occurredAt ?? new Date(),
        },
        select: { id: true },
      });
      return { id: event.id };
    } catch {
      throw new InternalServerErrorException('Failed to record audit event in transaction');
    }
  }

  async readEventsByCompany(params: ReadEventsParams): Promise<AuditEventsPage> {
    const where: Record<string, unknown> = {
      companyId: params.companyId,
    };

    if (params.action) {
      where.action = params.action;
    }
    if (params.resourceType) {
      where.resourceType = params.resourceType;
    }
    if (params.actorUserId) {
      where.actorUserId = params.actorUserId;
    }
    if (params.result) {
      where.result = params.result;
    }

    const occurredAtFilter: Record<string, unknown> = {};
    if (params.from) {
      occurredAtFilter.gte = params.from;
    }
    if (params.to) {
      occurredAtFilter.lte = params.to;
    }
    if (Object.keys(occurredAtFilter).length > 0) {
      where.occurredAt = occurredAtFilter;
    }

    if (params.cursorOccurredAt && params.cursorId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).OR = [
        { occurredAt: { lt: params.cursorOccurredAt } },
        {
          occurredAt: { equals: params.cursorOccurredAt },
          id: { lt: params.cursorId },
        },
      ];
    }

    const events = await this.prismaService.prisma.auditEvent.findMany({
      where,
      orderBy: [
        { occurredAt: 'desc' },
        { id: 'desc' },
      ],
      take: params.limit + 1,
    });

    const hasMore = events.length > params.limit;
    if (hasMore) {
      events.pop();
    }

    let nextCursor: string | null = null;
    if (hasMore && events.length > 0) {
      const last = events[events.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ occurredAt: last.occurredAt.toISOString(), id: last.id }),
      ).toString('base64');
    }

    return {
      events: events.map((event) => this.mapEventToResponse(event)),
      nextCursor,
    };
  }

  private mapEventToResponse(event: {
    id: string;
    occurredAt: Date;
    actorType: string;
    actorUserId: string | null;
    actorEmail: string | null;
    actorGlobalRole: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    result: string;
    failureReason: string | null;
    changes: unknown;
    metadata: unknown;
    requestId: string | null;
  }): AuditEventResponse {
    const actor: AuditActorResponse = {
      type: event.actorType as AuditActorType,
    };
    if (event.actorUserId) {
      actor.userId = event.actorUserId;
    }
    if (event.actorEmail) {
      actor.email = event.actorEmail;
    }
    if (event.actorGlobalRole) {
      actor.globalRole = event.actorGlobalRole;
    }

    const resource: AuditResourceResponse = {
      type: event.resourceType as AuditResourceType,
    };
    if (event.resourceId) {
      resource.id = event.resourceId;
    }

    const response: AuditEventResponse = {
      id: event.id,
      occurredAt: event.occurredAt,
      actor,
      action: event.action as AuditAction,
      resource,
      result: event.result as AuditResult,
    };

    if (event.failureReason) {
      response.failureReason = event.failureReason;
    }
    if (event.changes !== null && event.changes !== undefined) {
      response.changes = sanitizeAuditPayload(event.changes);
    }
    if (event.metadata !== null && event.metadata !== undefined) {
      response.metadata = sanitizeAuditPayload(event.metadata);
    }
    if (event.requestId) {
      response.requestId = event.requestId;
    }

    return response;
  }
}
