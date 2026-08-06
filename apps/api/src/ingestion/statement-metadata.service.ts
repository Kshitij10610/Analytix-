import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { AuditAction, AuditActorType, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatementMetadataDto, StatementMetadataResponse } from './dto/statement-metadata.dto';

@Injectable()
export class StatementMetadataService {
  private readonly logger = new Logger(StatementMetadataService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) { }

  async finalizeStatementMetadata(
    companyId: string,
    importJobId: string,
    dto: StatementMetadataDto,
    actorId: string,
  ): Promise<StatementMetadataResponse> {
    const userRole = await this.getActorRole(actorId);
    const actorEmail = await this.getActorEmail(actorId);
    await this.companyAccessService.requireCompanyWrite(actorId, companyId, userRole);

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (Number.isNaN(periodStart.getTime())) {
      throw new BadRequestException('Invalid periodStart date');
    }
    if (Number.isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Invalid periodEnd date');
    }
    if (periodEnd < periodStart) {
      throw new BadRequestException('periodEnd must be on or after periodStart');
    }

    const result = await this.prismaService.prisma.$transaction(async (tx) => {
      const jobRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          statementType: string | null;
          normalizedAt: Date | null;
          periodStart: Date | null;
          periodEnd: Date | null;
          fiscalYear: number | null;
          periodType: string | null;
          currency: string | null;
          scale: string | null;
        }>
      >`SELECT id, status, "statementType", "normalizedAt", "periodStart", "periodEnd", "fiscalYear", "periodType", "currency", "scale" FROM "import_jobs" WHERE "id" = ${importJobId} AND "companyId" = ${companyId} FOR UPDATE`;

      const job = jobRows[0];
      if (!job) {
        throw new NotFoundException('Import job not found');
      }

      if (job.status === 'READY') {
        throw new BadRequestException('Import job is already READY and metadata is immutable');
      }

      if (job.status !== 'VALIDATED') {
        throw new BadRequestException(
          `Import job is in state "${job.status}" and cannot be finalized`,
        );
      }

      if (job.statementType === null) {
        throw new BadRequestException('Import job has no statement type; cannot finalize');
      }

      if (job.normalizedAt === null) {
        throw new BadRequestException(
          'Import job has not been normalized; call /normalize first',
        );
      }

      const existingRows = await tx.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count FROM "import_normalized_rows"
        WHERE "companyId" = ${companyId} AND "importJobId" = ${importJobId}
      `;
      const normalizedCount = Number(existingRows[0]?.count ?? 0);
      if (normalizedCount === 0) {
        throw new BadRequestException(
          'No normalized rows found; normalization produced no observations',
        );
      }

      const now = new Date();
      await tx.$executeRaw`
        UPDATE "import_jobs"
        SET
          "periodStart" = ${periodStart},
          "periodEnd" = ${periodEnd},
          "fiscalYear" = ${dto.fiscalYear},
          "periodType" = ${dto.periodType},
          "currency" = ${dto.currency},
          "scale" = ${dto.scale},
          "status" = 'READY',
          "updatedAt" = ${now}
        WHERE "id" = ${importJobId} AND "companyId" = ${companyId} AND "status" = 'VALIDATED'
      `;

      const updatedRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          statementType: string | null;
          periodStart: Date;
          periodEnd: Date;
          fiscalYear: number;
          periodType: string;
          currency: string;
          scale: string;
        }>
      >`SELECT id, status, "statementType", "periodStart", "periodEnd", "fiscalYear", "periodType", "currency", "scale" FROM "import_jobs" WHERE "id" = ${importJobId} AND "companyId" = ${companyId}`;

      const updated = updatedRows[0];
      if (!updated) {
        throw new BadRequestException('Failed to finalize statement metadata');
      }

      await this.auditService.recordInTransaction({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: userRole,
        companyId,
        action: AuditAction.INGEST_READY,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: importJobId,
        result: AuditResult.SUCCESS,
        metadata: {
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          fiscalYear: dto.fiscalYear,
          periodType: dto.periodType,
          currency: dto.currency,
          scale: dto.scale,
          statementType: updated.statementType!,
          normalizedRowCount: normalizedCount,
        },
      }, tx as any);

      return {
        importJobId: updated.id,
        status: updated.status,
        periodStart: updated.periodStart.toISOString().split('T')[0],
        periodEnd: updated.periodEnd.toISOString().split('T')[0],
        fiscalYear: updated.fiscalYear,
        periodType: updated.periodType,
        currency: updated.currency,
        scale: updated.scale,
        normalizedRowCount: normalizedCount,
        statementType: updated.statementType!,
      };
    });

    return result;
  }

  private async getActorRole(actorId: string): Promise<string> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.role;
  }

  private async getActorEmail(actorId: string): Promise<string> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: actorId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.email;
  }
}
