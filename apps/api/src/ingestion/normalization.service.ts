import { randomUUID } from 'crypto';
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { AuditAction, AuditActorType, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';

export interface NormalizationResponse {
  importJobId: string;
  status: string;
  valid: boolean;
  normalizedRowCount: number;
  statementType: string | null;
  readyBlockedReason: string | null;
}

interface MappingSheet {
  sheetIndex: number;
  sheetName: string;
  headers: string[];
  columns: Array<{ sourceIndex: number; sourceHeader: string; role: string; status: string }>;
  rowMappings: Array<{
    rowNumber: number;
    sourceLabel: string;
    metricCode: string | null;
    statementType: string | null;
    status: string;
    candidates: Array<{ code: string; label: string; category: string; statementType: string }>;
  }>;
}

interface MetricDefInfo {
  id: string;
  code: string;
  label: string;
  category: string;
  statementType: string;
}

const POSITIVE_MAGNITUDE_CATEGORIES = new Set([
  'Revenue',
  'Operating Expenses',
  'Taxes',
  'Assets',
  'Liabilities',
  'Equity',
]);

const SIGNED_CATEGORIES = new Set([
  'Profitability',
  'Non-Operating',
  'Operating',
  'Investing',
  'Financing',
  'Summary',
]);

function normalizeSign(value: string, category: string): string {
  const trimmed = value.trim();
  if (POSITIVE_MAGNITUDE_CATEGORIES.has(category)) {
    if (trimmed.startsWith('-')) {
      return trimmed.substring(1);
    }
    return trimmed;
  }
  return trimmed;
}

interface NormalizedObservation {
  metricDefinitionId: string;
  value: string;
  statementType: string;
  sheetIndex: number;
  rowNumber: number;
  sourceIndex: number | null;
}

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) { }

  async normalizeImportJob(
    companyId: string,
    importJobId: string,
    actorId: string,
  ): Promise<NormalizationResponse> {
    await this.companyAccessService.requireCompanyWrite(
      actorId,
      companyId,
      await this.getActorRole(actorId),
    );

    const importJobRows = await this.prismaService.prisma.$queryRaw<
      Array<{ id: string; status: string; mapping: unknown; statementType: string | null; normalizedAt: Date | null }>
    >`SELECT "id", "status", "mapping", "statementType", "normalizedAt" FROM "import_jobs" WHERE "id" = ${importJobId} AND "companyId" = ${companyId}`;
    const importJob = importJobRows[0];
    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    if (importJob.status !== 'VALIDATED') {
      throw new BadRequestException(
        `Import job is in state "${importJob.status}" and cannot be normalized`,
      );
    }

    const mapping = this.parseMapping(importJob.mapping);
    if (!mapping || !Array.isArray(mapping.sheets)) {
      throw new BadRequestException('Import job mapping is corrupt or unreadable');
    }

    const sheets = mapping.sheets as MappingSheet[];

    const statementType = this.resolveStatementType(importJob, sheets);
    if (!statementType) {
      throw new BadRequestException(
        'Import job has no resolvable statement type; cannot normalize',
      );
    }

    const metricDefs = await this.prismaService.prisma.metricDefinition.findMany({
      select: { id: true, code: true, label: true, category: true, statementType: true },
    });
    const metricDefMap = this.buildMetricDefMap(metricDefs);

    const rawRows = await this.prismaService.prisma.importRawRow.findMany({
      where: { companyId, importJobId },
      orderBy: [{ sheetIndex: 'asc' }, { rowNumber: 'asc' }],
    });
    const rawRowMap = new Map<string, { values: unknown }>();
    for (const row of rawRows) {
      rawRowMap.set(`${row.sheetIndex}:${row.rowNumber}`, { values: row.values });
    }

    const observations: NormalizedObservation[] = [];
    const seenMetricDefs = new Set<string>();

    for (const sheet of sheets) {
      const valueColumn = sheet.columns.find((c) => c.role === 'VALUE');
      const valueSourceIndex = valueColumn ? valueColumn.sourceIndex : 1;

      for (const rowMapping of sheet.rowMappings) {
        if (!rowMapping.metricCode || rowMapping.status !== 'AUTO_MAPPED' && rowMapping.status !== 'USER_CONFIRMED') {
          continue;
        }

        const def = metricDefMap.get(`${rowMapping.metricCode}:${statementType}`);
        if (!def) {
          throw new BadRequestException(
            `Metric "${rowMapping.metricCode}" referenced in mapping but not found in catalog`,
          );
        }

        if (def.statementType !== statementType) {
          throw new BadRequestException(
            `Metric "${def.code}" has statement type "${def.statementType}" which does not match job statement type "${statementType}"`,
          );
        }

        if (!def.category) {
          throw new BadRequestException(
            `Metric "${def.code}" has no category; cannot determine sign policy`,
          );
        }

        if (!POSITIVE_MAGNITUDE_CATEGORIES.has(def.category) && !SIGNED_CATEGORIES.has(def.category)) {
          throw new BadRequestException(
            `Ambiguous sign convention for metric "${def.code}" in category "${def.category}"; no normalization policy available`,
          );
        }

        if (seenMetricDefs.has(def.id)) {
          throw new BadRequestException(
            `Duplicate metric "${def.code}" mapped to multiple rows within the same import job`,
          );
        }
        seenMetricDefs.add(def.id);

        const rawRowKey = `${sheet.sheetIndex}:${rowMapping.rowNumber}`;
        const rawRow = rawRowMap.get(rawRowKey);
        if (!rawRow) {
          throw new BadRequestException(
            `No staged raw row at sheetIndex=${sheet.sheetIndex}, rowNumber=${rowMapping.rowNumber}`,
          );
        }

        const values = rawRow.values as string[];
        if (!Array.isArray(values)) {
          throw new BadRequestException(
            `Raw row values at sheetIndex=${sheet.sheetIndex}, rowNumber=${rowMapping.rowNumber} is not an array`,
          );
        }

        const rawValue: string =
          valueSourceIndex < values.length ? (values[valueSourceIndex] ?? '') : '';

        if (rawValue === '') {
          continue;
        }

        const trimmed = rawValue.trim();
        const normalizedValue = normalizeSign(trimmed, def.category);

        observations.push({
          metricDefinitionId: def.id,
          value: normalizedValue,
          statementType: def.statementType,
          sheetIndex: sheet.sheetIndex,
          rowNumber: rowMapping.rowNumber,
          sourceIndex: valueSourceIndex,
        });
      }
    }

    // Idempotency: check for existing normalized rows
    const existingCountRows = await this.prismaService.prisma.$queryRaw<
      Array<{ count: number }>
    >`SELECT COUNT(*)::int as count FROM "import_normalized_rows" WHERE "companyId" = ${companyId} AND "importJobId" = ${importJobId}`;
    const existingCount = Number(existingCountRows[0]?.count ?? 0);

    let normalizedRowCount = existingCount;

    if (existingCount === 0 && observations.length > 0) {
      await this.prismaService.prisma.$transaction(async (tx) => {
        const now = new Date();
        for (const obs of observations) {
          await tx.$executeRaw`
            INSERT INTO "import_normalized_rows"
              ("id", "companyId", "importJobId", "metricDefinitionId", "value", "statementType", "sheetIndex", "rowNumber", "sourceIndex", "createdAt")
            VALUES
              (${randomUUID()}, ${companyId}, ${importJobId}, ${obs.metricDefinitionId}, ${obs.value}, ${obs.statementType}, ${obs.sheetIndex}, ${obs.rowNumber}, ${obs.sourceIndex}, ${now})
          `;
        }
        await tx.$executeRaw`
          UPDATE "import_jobs"
          SET "normalizedAt" = ${now}
          WHERE "id" = ${importJobId} AND "companyId" = ${companyId}
        `;
      });
      normalizedRowCount = observations.length;
    } else if (existingCount > 0 && importJob.normalizedAt === null) {
      await this.prismaService.prisma.$executeRaw`
        UPDATE "import_jobs"
        SET "normalizedAt" = ${new Date()}
        WHERE "id" = ${importJobId} AND "companyId" = ${companyId}
      `;
    }

    const readyBlockedReason = await this.checkReadyBlockers(companyId, importJobId, importJob);

    const actorEmail = await this.getActorEmail(actorId);
    const actorRole = await this.getActorRole(actorId);
    await this.auditService.record({
      actorType: AuditActorType.USER,
      actorUserId: actorId,
      actorEmail,
      actorGlobalRole: actorRole,
      companyId,
      action: AuditAction.INGEST_NORMALIZED,
      resourceType: AuditResourceType.IMPORT_JOB,
      resourceId: importJobId,
      result: AuditResult.SUCCESS,
      metadata: { normalizedRowCount, statementType },
    });

    return {
      importJobId,
      status: 'VALIDATED',
      valid: true,
      normalizedRowCount,
      statementType,
      readyBlockedReason,
    };
  }

  private parseMapping(mapping: unknown): { version: number; orientation: string; sheets: MappingSheet[] } | null {
    if (!mapping || typeof mapping !== 'object') {
      return null;
    }
    const m = mapping as Record<string, unknown>;
    if (typeof m.version !== 'number' || typeof m.orientation !== 'string') {
      return null;
    }
    if (!Array.isArray(m.sheets)) {
      return null;
    }
    return {
      version: m.version,
      orientation: m.orientation,
      sheets: m.sheets as MappingSheet[],
    };
  }

  private buildMetricDefMap(defs: MetricDefInfo[]): Map<string, MetricDefInfo> {
    const map = new Map<string, MetricDefInfo>();
    for (const def of defs) {
      map.set(`${def.code}:${def.statementType}`, def);
    }
    return map;
  }

  private resolveStatementType(
    importJob: { statementType: string | null },
    sheets: MappingSheet[],
  ): string | null {
    if (importJob.statementType) {
      return importJob.statementType;
    }

    const statementTypes = new Set<string>();
    for (const sheet of sheets) {
      for (const rowMapping of sheet.rowMappings) {
        if (
          rowMapping.metricCode &&
          (rowMapping.status === 'AUTO_MAPPED' || rowMapping.status === 'USER_CONFIRMED') &&
          rowMapping.statementType
        ) {
          statementTypes.add(rowMapping.statementType);
        }
      }
    }

    if (statementTypes.size === 1) {
      return Array.from(statementTypes)[0];
    }
    return null;
  }

  private async checkReadyBlockers(
    companyId: string,
    importJobId: string,
    importJob: { statementType: string | null },
  ): Promise<string | null> {
    const missing: string[] = [];

    if (importJob.statementType === null) {
      missing.push('statementType');
    }

    const metaRows = await this.prismaService.prisma.$queryRaw<
      Array<{
        periodStart: Date | null;
        periodEnd: Date | null;
        fiscalYear: number | null;
        periodType: string | null;
        currency: string | null;
        scale: string | null;
        normalizedAt: Date | null;
      }>
    >`SELECT "periodStart", "periodEnd", "fiscalYear", "periodType", "currency", "scale", "normalizedAt" FROM "import_jobs" WHERE "id" = ${importJobId} AND "companyId" = ${companyId}`;
    const meta = metaRows[0];

    if (!meta) {
      return 'Import job not found';
    }

    if (meta.normalizedAt === null) {
      missing.push('normalization (normalizedAt)');
    }
    if (meta.periodStart === null) missing.push('periodStart');
    if (meta.periodEnd === null) missing.push('periodEnd');
    if (meta.fiscalYear === null) missing.push('fiscalYear');
    if (meta.periodType === null) missing.push('periodType');
    if (meta.currency === null) missing.push('currency');
    if (meta.scale === null) missing.push('scale');

    if (missing.length > 0) {
      return `READY requires: ${missing.join(', ')}. Submit statement metadata via PUT /companies/:companyId/imports/:importJobId/statement-metadata.`;
    }

    return null;
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

