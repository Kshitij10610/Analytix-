import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService, Decimal } from '../prisma/prisma.service';
import { TransactionClient } from '../generated/internal/prismaNamespace';

type FinancialStatementType = 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';
type FinancialPeriodType = 'ANNUAL' | 'QUARTERLY' | 'TTM';
type FinancialScale = 'ONES' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
type FinancialDataSourceType = 'MANUAL' | 'CSV_IMPORT' | 'API' | 'AI_EXTRACTED';

interface CreateStatementData {
  type: FinancialStatementType;
  periodStart: Date;
  periodEnd: Date;
  fiscalYear: number;
  fiscalQuarter?: number;
  periodType: FinancialPeriodType;
  currency: string;
  scale: FinancialScale;
  sourceType?: FinancialDataSourceType;
  sourceReference?: string;
  importedAt?: Date;
  importedBy?: string | null;
}

interface CreateLineItemInput {
  metricCode: string;
  value: string;
  labelOverride?: string;
  displayOrder?: number;
}

interface StatementLineItemDto {
  metricCode: string;
  label: string;
  value: string;
  displayOrder: number | null;
  isStandard: boolean;
}

export interface FindOneWithLineItemsResponse {
  id: string;
  companyId: string;
  type: FinancialStatementType;
  periodStart: Date;
  periodEnd: Date;
  fiscalYear: number;
  fiscalQuarter: number | null;
  periodType: FinancialPeriodType;
  currency: string;
  scale: FinancialScale;
  sourceType: FinancialDataSourceType | null;
  sourceReference: string | null;
  importedAt: Date | null;
  importedBy: string | null;
  lineItems: StatementLineItemDto[];
}

function validateDecimal(value: string): string {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new BadRequestException('Invalid decimal format');
  }
  return trimmed;
}

function parseDecimal(value: string): Decimal {
  try {
    return new Decimal(value);
  } catch {
    throw new BadRequestException('Invalid decimal format');
  }
}

@Injectable()
export class FinancialsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    companyId: string,
    data: CreateStatementData,
    userId: string,
    userRole: string,
    actorEmail: string,
  ) {
    await this.companyAccessService.requireCompanyWrite(userId, companyId, userRole);

    if (data.periodEnd < data.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of ['type', 'fiscalYear', 'periodType', 'currency', 'scale', 'sourceType', 'sourceReference'] as const) {
      if (data[key] !== undefined) changes[key] = { before: null, after: data[key] };
    }

    try {
      return await this.prismaService.prisma.$transaction(async (tx: any) => {
        const statement = await tx.financialStatement.create({
          data: {
            ...data,
            companyId,
          },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId,
          action: AuditAction.FINANCIAL_STATEMENT_CREATE,
          resourceType: AuditResourceType.FINANCIAL_STATEMENT,
          resourceId: statement.id,
          result: AuditResult.SUCCESS,
          changes,
          metadata: {
            statementType: data.type,
            fiscalYear: data.fiscalYear,
            currency: data.currency,
            scale: data.scale,
            lineItemCount: 0,
          },
        }, tx as TransactionClient);

        return statement;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ConflictException('Unable to create financial statement');
    }
  }

  async createWithLineItems(
    companyId: string,
    data: CreateStatementData,
    items: CreateLineItemInput[],
    userId: string,
    userRole: string,
    actorEmail: string,
  ) {
    await this.companyAccessService.requireCompanyWrite(userId, companyId, userRole);

    if (data.periodEnd < data.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    const seenCodes = new Set<string>();
    for (const item of items) {
      const code = item.metricCode.toUpperCase();
      if (seenCodes.has(code)) {
        throw new BadRequestException(`Duplicate metricCode in payload: ${code}`);
      }
      seenCodes.add(code);
      validateDecimal(item.value);
    }

    const metrics = await this.prismaService.prisma.metricDefinition.findMany({
      where: {
        code: { in: Array.from(seenCodes) },
        statementType: data.type,
      },
    });
    const metricMap = new Map(metrics.map((m) => [m.code, m]));

    const unknownCodes = Array.from(seenCodes).filter((code) => !metricMap.has(code));
    if (unknownCodes.length > 0) {
      throw new BadRequestException(`Unknown metricCodes for ${data.type}: ${unknownCodes.join(', ')}`);
    }

    const lineItemsData = items.map((item) => {
      const metric = metricMap.get(item.metricCode.toUpperCase())!;
      return {
        metricDefinitionId: metric.id,
        statementType: data.type,
        value: parseDecimal(validateDecimal(item.value)),
        labelOverride: item.labelOverride,
        displayOrder: item.displayOrder,
      };
    });

    try {
      return await this.prismaService.prisma.$transaction(async (tx: any) => {
        const statement = await tx.financialStatement.create({
          data: {
            ...data,
            companyId,
          },
        });

        if (lineItemsData.length > 0) {
          await tx.financialLineItem.createMany({
            data: lineItemsData.map((li) => ({
              ...li,
              financialStatementId: statement.id,
            })),
          });
        }

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId,
          action: AuditAction.FINANCIAL_STATEMENT_CREATE,
          resourceType: AuditResourceType.FINANCIAL_STATEMENT,
          resourceId: statement.id,
          result: AuditResult.SUCCESS,
          metadata: {
            statementType: data.type,
            fiscalYear: data.fiscalYear,
            currency: data.currency,
            scale: data.scale,
            lineItemCount: items.length,
          },
        }, tx as TransactionClient);

        return statement;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ConflictException('Unable to create financial statement');
    }
  }

  async findByCompany(companyId: string, userId: string, userRole: string) {
    await this.companyAccessService.requireCompanyRead(userId, companyId, userRole);

    return await this.prismaService.prisma.financialStatement.findMany({
      where: { companyId },
      orderBy: { periodStart: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const statement = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id },
    });
    if (!statement) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyRead(userId, statement.companyId, userRole);

    return statement;
  }

  async findOneWithLineItems(statementId: string, userId: string, userRole: string): Promise<FindOneWithLineItemsResponse> {
    const statement = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id: statementId },
      select: {
        id: true,
        companyId: true,
        type: true,
        periodStart: true,
        periodEnd: true,
        fiscalYear: true,
        fiscalQuarter: true,
        periodType: true,
        currency: true,
        scale: true,
        sourceType: true,
        sourceReference: true,
        importedAt: true,
        importedBy: true,
      },
    });
    if (!statement) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyRead(userId, statement.companyId, userRole);

    const lineItems = await this.prismaService.prisma.financialLineItem.findMany({
      where: { financialStatementId: statementId },
      include: {
        metric_definitions: true,
      },
    });

    const mapped = lineItems.map((li) => ({
      metricCode: li.metric_definitions.code,
      label: li.labelOverride ?? li.metric_definitions.label,
      value: li.value.toFixed(6),
      displayOrder: li.displayOrder,
      isStandard: li.metric_definitions.isStandard,
    }));

    mapped.sort((a, b) => {
      const aOrder = a.displayOrder ?? 0;
      const bOrder = b.displayOrder ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.metricCode.localeCompare(b.metricCode);
    });

    return {
      id: statement.id,
      companyId: statement.companyId,
      type: statement.type,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      fiscalYear: statement.fiscalYear,
      fiscalQuarter: statement.fiscalQuarter,
      periodType: statement.periodType,
      currency: statement.currency,
      scale: statement.scale,
      sourceType: statement.sourceType,
      sourceReference: statement.sourceReference,
      importedAt: statement.importedAt,
      importedBy: statement.importedBy,
      lineItems: mapped,
    };
  }

  async update(
    id: string,
    data: Partial<CreateStatementData>,
    userId: string,
    userRole: string,
    actorEmail: string,
  ) {
    const existing = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        type: true,
        fiscalYear: true,
        periodType: true,
        currency: true,
        scale: true,
        sourceType: true,
        sourceReference: true,
        periodStart: true,
        periodEnd: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyWrite(userId, existing.companyId, userRole);

    if (data.periodStart && data.periodEnd && data.periodEnd < data.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }
    if (data.periodStart && !data.periodEnd && data.periodStart > existing.periodEnd) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }
    if (data.periodEnd && !data.periodStart && data.periodEnd < existing.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    const updateData: Record<string, unknown> = {};

    if (data.type !== undefined && data.type !== existing.type) {
      changes.type = { before: existing.type, after: data.type };
      updateData.type = data.type;
    }
    if (data.fiscalYear !== undefined && data.fiscalYear !== existing.fiscalYear) {
      changes.fiscalYear = { before: existing.fiscalYear, after: data.fiscalYear };
      updateData.fiscalYear = data.fiscalYear;
    }
    if (data.periodType !== undefined && data.periodType !== existing.periodType) {
      changes.periodType = { before: existing.periodType, after: data.periodType };
      updateData.periodType = data.periodType;
    }
    if (data.currency !== undefined && data.currency !== existing.currency) {
      changes.currency = { before: existing.currency, after: data.currency };
      updateData.currency = data.currency;
    }
    if (data.scale !== undefined && data.scale !== existing.scale) {
      changes.scale = { before: existing.scale, after: data.scale };
      updateData.scale = data.scale;
    }
    if (data.sourceType !== undefined && data.sourceType !== existing.sourceType) {
      changes.sourceType = { before: existing.sourceType, after: data.sourceType };
      updateData.sourceType = data.sourceType;
    }
    if (data.sourceReference !== undefined && data.sourceReference !== existing.sourceReference) {
      changes.sourceReference = { before: existing.sourceReference, after: data.sourceReference };
      updateData.sourceReference = data.sourceReference;
    }
    if (data.periodStart !== undefined && data.periodStart !== existing.periodStart) {
      changes.periodStart = { before: existing.periodStart, after: data.periodStart };
      updateData.periodStart = data.periodStart;
    }
    if (data.periodEnd !== undefined && data.periodEnd !== existing.periodEnd) {
      changes.periodEnd = { before: existing.periodEnd, after: data.periodEnd };
      updateData.periodEnd = data.periodEnd;
    }

    if (Object.keys(changes).length === 0) {
      const full = await this.prismaService.prisma.financialStatement.findUnique({
        where: { id },
      });
      return full;
    }

    try {
      return await this.prismaService.prisma.$transaction(async (tx: any) => {
        const updated = await tx.financialStatement.update({
          where: { id },
          data: updateData,
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: existing.companyId,
          action: AuditAction.FINANCIAL_STATEMENT_UPDATE,
          resourceType: AuditResourceType.FINANCIAL_STATEMENT,
          resourceId: id,
          result: AuditResult.SUCCESS,
          changes,
        }, tx as TransactionClient);

        return updated;
      });
    } catch {
      throw new NotFoundException('Financial statement not found');
    }
  }

  async remove(id: string, userId: string, userRole: string, actorEmail: string) {
    const existing = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id },
      select: { id: true, companyId: true, company: { select: { name: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyWrite(userId, existing.companyId, userRole);

    try {
      await this.prismaService.prisma.$transaction(async (tx: any) => {
        await tx.financialStatement.delete({
          where: { id },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: existing.companyId,
          action: AuditAction.FINANCIAL_STATEMENT_DELETE,
          resourceType: AuditResourceType.FINANCIAL_STATEMENT,
          resourceId: id,
          result: AuditResult.SUCCESS,
          metadata: {
            companyName: existing.company?.name ?? null,
          },
        }, tx as TransactionClient);
      });
    } catch {
      throw new NotFoundException('Financial statement not found');
    }
  }
}
