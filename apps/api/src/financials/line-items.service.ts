import { ConflictException, Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService, Decimal } from '../prisma/prisma.service';

@Injectable()
export class LineItemsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  private parseDecimal(value: string): Decimal {
    try {
      return new Decimal(value);
    } catch {
      throw new BadRequestException('Invalid decimal format');
    }
  }

  private validateDecimal(value: string) {
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d{1,6})?$/.test(trimmed)) {
      throw new BadRequestException('Invalid decimal format');
    }
    return trimmed;
  }

  async findByStatement(statementId: string, userId: string, userRole: string) {
    const statement = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id: statementId },
      select: { id: true, companyId: true },
    });
    if (!statement) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyRead(userId, statement.companyId, userRole);

    return this.prismaService.prisma.financialLineItem.findMany({
      where: { financialStatementId: statementId },
      include: { metric_definitions: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(statementId: string, metricCode: string, data: { value: string; labelOverride?: string; displayOrder?: number }, userId: string, userRole: string, actorEmail: string) {
    const statement = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id: statementId },
      select: { id: true, type: true, companyId: true },
    });
    if (!statement) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyWrite(userId, statement.companyId, userRole);

    const normalizedCode = metricCode.toUpperCase();
    const metric = await this.prismaService.prisma.metricDefinition.findFirst({
      where: { code: normalizedCode, statementType: statement.type },
    });
    if (!metric) {
      throw new BadRequestException('Metric is not compatible with this financial statement type');
    }

    const parsedValue = this.parseDecimal(this.validateDecimal(data.value));

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const lineItem = await tx.financialLineItem.create({
          data: {
            financialStatementId: statementId,
            metricDefinitionId: metric.id,
            statementType: statement.type,
            value: parsedValue,
            labelOverride: data.labelOverride,
            displayOrder: data.displayOrder,
          },
          include: { metric_definitions: true },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: statement.companyId,
          action: AuditAction.LINE_ITEM_CREATE,
          resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
          resourceId: lineItem.id,
          result: AuditResult.SUCCESS,
          changes: {
            value: { before: null, after: data.value },
            ...(data.labelOverride !== undefined ? { labelOverride: { before: null, after: data.labelOverride } } : {}),
            ...(data.displayOrder !== undefined ? { displayOrder: { before: null, after: data.displayOrder } } : {}),
          },
          metadata: {
            statementId,
            metricCode: normalizedCode,
          },
        }, tx);

        return lineItem;
      });
    } catch (error) {
      const code = (error as unknown as { code?: string }).code;
      if (code === 'P2002') {
        throw new ConflictException('This metric already exists for the financial statement');
      }
      throw new ConflictException('Unable to create line item');
    }
  }

  async update(id: string, data: { value?: string; labelOverride?: string; displayOrder?: number }, userId: string, userRole: string, actorEmail: string) {
    const existing = await this.prismaService.prisma.financialLineItem.findUnique({
      where: { id },
      include: { financial_statements: true, metric_definitions: true },
    });
    if (!existing) {
      throw new NotFoundException('Financial line item not found');
    }

    await this.companyAccessService.requireCompanyWrite(userId, existing.financial_statements.companyId, userRole);

    const payload: Record<string, unknown> = {};
    if (data.value !== undefined) {
      payload.value = this.parseDecimal(this.validateDecimal(data.value));
    }
    if (data.labelOverride !== undefined) payload.labelOverride = data.labelOverride;
    if (data.displayOrder !== undefined) payload.displayOrder = data.displayOrder;

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (data.value !== undefined) changes.value = { before: existing.value.toFixed(6), after: data.value };
    if (data.labelOverride !== undefined) changes.labelOverride = { before: existing.labelOverride, after: data.labelOverride };
    if (data.displayOrder !== undefined) changes.displayOrder = { before: existing.displayOrder, after: data.displayOrder };

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const updated = await tx.financialLineItem.update({
          where: { id },
          data: payload,
          include: { metric_definitions: true },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: existing.financial_statements.companyId,
          action: AuditAction.LINE_ITEM_UPDATE,
          resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
          resourceId: updated.id,
          result: AuditResult.SUCCESS,
          changes,
        }, tx);

        return updated;
      });
    } catch (error) {
      const code = (error as unknown as { code?: string }).code;
      if (code === 'P2002') {
        throw new ConflictException('This metric already exists for the financial statement');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string, userRole: string, actorEmail: string) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can delete financial line items');
    }

    const existing = await this.prismaService.prisma.financialLineItem.findUnique({
      where: { id },
      include: { financial_statements: true, metric_definitions: true },
    });
    if (!existing) {
      throw new NotFoundException('Financial line item not found');
    }

    try {
      await this.prismaService.prisma.$transaction(async (tx) => {
        await tx.financialLineItem.delete({ where: { id } });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: existing.financial_statements.companyId,
          action: AuditAction.LINE_ITEM_DELETE,
          resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
          resourceId: existing.id,
          result: AuditResult.SUCCESS,
          changes: {
            value: { before: existing.value.toFixed(6), after: null },
            labelOverride: { before: existing.labelOverride, after: null },
            displayOrder: { before: existing.displayOrder, after: null },
          },
          metadata: {
            statementId: existing.financialStatementId,
            metricCode: existing.metric_definitions.code,
          },
        }, tx);
      });
    } catch (error) {
      const code = (error as unknown as { code?: string }).code;
      if (code === 'P2025') {
        throw new NotFoundException('Financial line item not found');
      }
      throw error;
    }
  }

  async replaceLineItems(statementId: string, items: Array<{ metricCode: string; value: string; labelOverride?: string; displayOrder?: number }>, userId: string, userRole: string, actorEmail: string) {
    const statement = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id: statementId },
      select: { id: true, type: true, companyId: true },
    });
    if (!statement) {
      throw new NotFoundException('Financial statement not found');
    }

    await this.companyAccessService.requireCompanyWrite(userId, statement.companyId, userRole);

    const seenCodes = new Set<string>();
    for (const item of items) {
      const code = item.metricCode.toUpperCase();
      if (seenCodes.has(code)) {
        throw new BadRequestException(`Duplicate metricCode in payload: ${code}`);
      }
      seenCodes.add(code);
    }

    const existingLineItems = await this.prismaService.prisma.financialLineItem.findMany({
      where: { financialStatementId: statementId },
      include: { metric_definitions: true },
    });

    const existingMap = new Map<string, { id: string; value: string; labelOverride: string | null; displayOrder: number | null; metricCode: string }>();
    for (const li of existingLineItems) {
      existingMap.set(li.metric_definitions.code, {
        id: li.id,
        value: li.value.toFixed(6),
        labelOverride: li.labelOverride,
        displayOrder: li.displayOrder,
        metricCode: li.metric_definitions.code,
      });
    }

    const added: string[] = [];
    const removed: string[] = [];
    const updated: string[] = [];

    for (const code of seenCodes) {
      if (!existingMap.has(code)) {
        added.push(code);
      }
    }

    for (const code of existingMap.keys()) {
      if (!seenCodes.has(code)) {
        removed.push(code);
      }
    }

    for (const item of items) {
      const code = item.metricCode.toUpperCase();
      const existing = existingMap.get(code);
      if (existing) {
        const normalizedValue = this.validateDecimal(item.value);
        const valueChanged = existing.value !== normalizedValue;
        const labelChanged = (existing.labelOverride ?? null) !== (item.labelOverride ?? null);
        const orderChanged = existing.displayOrder !== item.displayOrder;
        if (valueChanged || labelChanged || orderChanged) {
          updated.push(code);
        }
      }
    }

    if (seenCodes.size === 0) {
      await this.prismaService.prisma.$transaction(async (tx) => {
        await tx.financialLineItem.deleteMany({ where: { financialStatementId: statementId } });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: statement.companyId,
          action: AuditAction.LINE_ITEMS_REPLACE,
          resourceType: AuditResourceType.FINANCIAL_STATEMENT,
          resourceId: statementId,
          result: AuditResult.SUCCESS,
          metadata: {
            beforeCount: existingLineItems.length,
            afterCount: 0,
            addedMetricCodes: [],
            removedMetricCodes: removed.sort(),
            updatedMetricCodes: [],
          },
        }, tx);
      });
      return [];
    }

    const metrics = await this.prismaService.prisma.metricDefinition.findMany({
      where: {
        code: { in: Array.from(seenCodes) },
        statementType: statement.type,
      },
    });
    const metricMap = new Map(metrics.map((m) => [m.code, m]));

    const unknownCodes = Array.from(seenCodes).filter((code) => !metricMap.has(code));
    if (unknownCodes.length > 0) {
      throw new BadRequestException(`Unknown metricCodes for ${statement.type}: ${unknownCodes.join(', ')}`);
    }

    const created = await this.prismaService.prisma.$transaction(async (tx) => {
      await tx.financialLineItem.deleteMany({ where: { financialStatementId: statementId } });

      const created = await Promise.all(
        items.map((item) => {
          const metric = metricMap.get(item.metricCode.toUpperCase())!;
          return tx.financialLineItem.create({
            data: {
              financialStatementId: statementId,
              metricDefinitionId: metric.id,
              statementType: statement.type,
              value: this.parseDecimal(this.validateDecimal(item.value)),
              labelOverride: item.labelOverride,
              displayOrder: item.displayOrder,
            },
            include: { metric_definitions: true },
          });
        }),
      );

      await this.auditService.recordInTransaction({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        actorEmail,
        actorGlobalRole: userRole,
        companyId: statement.companyId,
        action: AuditAction.LINE_ITEMS_REPLACE,
        resourceType: AuditResourceType.FINANCIAL_STATEMENT,
        resourceId: statementId,
        result: AuditResult.SUCCESS,
        metadata: {
          beforeCount: existingLineItems.length,
          afterCount: created.length,
          addedMetricCodes: added.sort(),
          removedMetricCodes: removed.sort(),
          updatedMetricCodes: updated.sort(),
        },
      }, tx);

      return created;
    });

    return created;
  }
}