import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService, ReadEventsParams } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditAction, AuditResourceType, AuditResult } from './audit.constants';
import { AuditEventsPage } from './dto/audit-event-response.dto';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';

@Controller('companies')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly companyAccessService: CompanyAccessService,
  ) {}

  @Get(':companyId/audit-events')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findCompanyAuditEvents(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Query() query: AuditEventsQueryDto,
  ): Promise<AuditEventsPage> {
    await this.companyAccessService.requireCompanyRead(user.userId, companyId, user.role);

    const limit = query.limit ?? 50;
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }

    if (query.action && !Object.values(AuditAction).includes(query.action as AuditAction)) {
      throw new BadRequestException('Invalid action');
    }
    if (query.resourceType && !Object.values(AuditResourceType).includes(query.resourceType as AuditResourceType)) {
      throw new BadRequestException('Invalid resourceType');
    }
    if (query.result && !Object.values(AuditResult).includes(query.result as AuditResult)) {
      throw new BadRequestException('Invalid result');
    }

    if (query.from) {
      const fromDate = new Date(query.from);
      if (isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid from date');
      }
    }
    if (query.to) {
      const toDate = new Date(query.to);
      if (isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid to date');
      }
    }

    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    let cursorOccurredAt: Date | undefined;
    let cursorId: string | undefined;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf-8'));
        cursorOccurredAt = new Date(decoded.occurredAt);
        cursorId = decoded.id;
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const params: ReadEventsParams = {
      companyId,
      action: query.action,
      resourceType: query.resourceType,
      actorUserId: query.actorUserId,
      result: query.result,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit,
      cursorOccurredAt,
      cursorId,
    };

    return this.auditService.readEventsByCompany(params);
  }
}
