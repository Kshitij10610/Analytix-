import { randomUUID } from 'crypto';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditActorType, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { $Enums } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CommitResponse {
  importJobId: string;
  status: string;
  statementId: string;
  lineItemCount: number;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  fiscalYear: number;
  periodType: string;
  currency: string;
  scale: string;
  sourceType: string;
  sourceReference: string;
}

interface ImportJobForCommit {
  id: string;
  status: string;
  statementType: string | null;
  committedStatementId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  fiscalYear: number | null;
  periodType: string | null;
  currency: string | null;
  scale: string | null;
  normalizedAt: Date | null;
}

interface NormalizedRowForCommit {
  id: string;
  metricDefinitionId: string;
  value: string;
  statementType: string;
}

const DECIMAL_REGEX = /^-?\d+(\.\d{1,6})?$/;

@Injectable()
export class TrustedCommitService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  async commitImportJob(
    companyId: string,
    importJobId: string,
    actorId: string,
  ): Promise<CommitResponse> {
    const userRole = await this.getActorRole(actorId);
    const actorEmail = await this.getActorEmail(actorId);
    await this.companyAccessService.requireCompanyWrite(actorId, companyId, userRole);

    const now = new Date();
    const commitAt = now;

    return await this.prismaService.prisma.$transaction(async (tx) => {
      const jobRows = await tx.$queryRaw<ImportJobForCommit[]>`
        SELECT
          id, status, "statementType", "committedStatementId",
          "periodStart", "periodEnd", "fiscalYear", "periodType",
          "currency", "scale", "normalizedAt"
        FROM "import_jobs"
        WHERE "id" = ${importJobId} AND "companyId" = ${companyId}
      `;

      const job = jobRows[0];
      if (!job) {
        throw new NotFoundException('Import job not found');
      }

      if (job.committedStatementId !== null) {
        const existing = await tx.financialStatement.findFirst({
          where: { id: job.committedStatementId, companyId },
          select: {
            id: true,
            type: true,
            periodStart: true,
            periodEnd: true,
            fiscalYear: true,
            periodType: true,
            currency: true,
            scale: true,
            sourceType: true,
            sourceReference: true,
            financial_line_items: {
              select: { id: true },
            },
          },
        });
        if (existing) {
          return {
            importJobId: job.id,
            status: 'COMPLETED',
            statementId: existing.id,
            lineItemCount: existing.financial_line_items.length,
            statementType: existing.type,
            periodStart: existing.periodStart.toISOString().split('T')[0],
            periodEnd: existing.periodEnd.toISOString().split('T')[0],
            fiscalYear: existing.fiscalYear,
            periodType: existing.periodType,
            currency: existing.currency,
            scale: existing.scale,
            sourceType: existing.sourceType ?? 'CSV_IMPORT',
            sourceReference: existing.sourceReference ?? job.id,
          };
        }
      }

      if (job.status !== 'READY') {
        throw new BadRequestException(
          `Import job is in state "${job.status}" and cannot be committed; must be READY`,
        );
      }

      if (job.statementType === null) {
        throw new BadRequestException('Import job has no statement type; expected Stage D resolution');
      }

      if (job.normalizedAt === null) {
        throw new BadRequestException('Import job has not been normalized; call /normalize first');
      }

      if (
        job.periodStart === null ||
        job.periodEnd === null ||
        job.fiscalYear === null ||
        job.periodType === null ||
        job.currency === null ||
        job.scale === null
      ) {
        throw new BadRequestException('Import job is missing trusted statement metadata');
      }

      const normalizedRows = await tx.$queryRaw<NormalizedRowForCommit[]>`
        SELECT id, "metricDefinitionId", "value", "statementType"
        FROM "import_normalized_rows"
        WHERE "companyId" = ${companyId} AND "importJobId" = ${importJobId}
        ORDER BY "metricDefinitionId"
      `;

      if (normalizedRows.length === 0) {
        throw new BadRequestException('No normalized rows found; cannot commit empty statement');
      }

      for (const row of normalizedRows) {
        if (!DECIMAL_REGEX.test(row.value)) {
          throw new BadRequestException(`Normalized row has invalid decimal value: "${row.value}"`);
        }
      }

      const statement = await tx.financialStatement.create({
        data: {
          id: randomUUID(),
          companyId,
          type: job.statementType as $Enums.FinancialStatementType,
          periodStart: job.periodStart,
          periodEnd: job.periodEnd,
          fiscalYear: job.fiscalYear,
          periodType: job.periodType as $Enums.FinancialPeriodType,
          currency: job.currency,
          scale: job.scale as $Enums.FinancialScale,
          sourceType: 'CSV_IMPORT',
          sourceReference: importJobId,
          importedAt: commitAt,
          importedBy: actorId,
        },
      });

      for (const row of normalizedRows) {
        await tx.financialLineItem.create({
          data: {
            id: randomUUID(),
            financialStatementId: statement.id,
            metricDefinitionId: row.metricDefinitionId,
            value: row.value,
            statementType: row.statementType as $Enums.FinancialStatementType,
            updatedAt: commitAt,
          },
        });
      }

      const claimResult = await tx.importJob.updateMany({
        where: {
          id: importJobId,
          companyId,
          status: 'READY',
          committedStatementId: null,
        },
        data: {
          status: $Enums.ImportJobStatus.COMPLETED,
          committedStatementId: statement.id,
          updatedAt: commitAt,
        },
      });

      if (claimResult.count === 1) {
        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: actorId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId,
          action: AuditAction.INGEST_COMMIT,
          resourceType: AuditResourceType.IMPORT_JOB,
          resourceId: importJobId,
          result: AuditResult.SUCCESS,
          metadata: {
            statementId: statement.id,
            lineItemCount: normalizedRows.length,
            statementType: job.statementType,
            periodStart: job.periodStart.toISOString().split('T')[0],
            periodEnd: job.periodEnd.toISOString().split('T')[0],
            fiscalYear: job.fiscalYear,
            periodType: job.periodType,
            currency: job.currency,
            scale: job.scale,
            sourceType: 'CSV_IMPORT',
            sourceReference: importJobId,
          },
        }, tx as any);

        return {
          importJobId: job.id,
          status: 'COMPLETED',
          statementId: statement.id,
          lineItemCount: normalizedRows.length,
          statementType: job.statementType,
          periodStart: job.periodStart.toISOString().split('T')[0],
          periodEnd: job.periodEnd.toISOString().split('T')[0],
          fiscalYear: job.fiscalYear,
          periodType: job.periodType,
          currency: job.currency,
          scale: job.scale,
          sourceType: 'CSV_IMPORT',
          sourceReference: importJobId,
        };
      }

      const current = await tx.importJob.findUnique({
        where: { id: importJobId },
        select: { committedStatementId: true, status: true },
      });

      if (current?.committedStatementId && current.committedStatementId !== statement.id) {
        await tx.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
        await tx.financialStatement.delete({ where: { id: statement.id } });

        const existing = await tx.financialStatement.findFirst({
          where: { id: current.committedStatementId, companyId },
          select: {
            id: true,
            type: true,
            periodStart: true,
            periodEnd: true,
            fiscalYear: true,
            periodType: true,
            currency: true,
            scale: true,
            sourceType: true,
            sourceReference: true,
            financial_line_items: {
              select: { id: true },
            },
          },
        });
        if (!existing) {
          throw new BadRequestException('Concurrent commit conflict; transaction rolled back');
        }
        return {
          importJobId: job.id,
          status: 'COMPLETED',
          statementId: existing.id,
          lineItemCount: existing.financial_line_items.length,
          statementType: existing.type,
          periodStart: existing.periodStart.toISOString().split('T')[0],
          periodEnd: existing.periodEnd.toISOString().split('T')[0],
          fiscalYear: existing.fiscalYear,
          periodType: existing.periodType,
          currency: existing.currency,
          scale: existing.scale,
          sourceType: existing.sourceType ?? 'CSV_IMPORT',
          sourceReference: existing.sourceReference ?? job.id,
        };
      }

      throw new BadRequestException('Failed to finalize ImportJob status; transaction rolled back');
    });
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
