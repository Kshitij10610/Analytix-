import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { AuditAction, AuditActorType, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { SheetMapping } from './mapping.service';

export interface ValidationIssue {
  code: string;
  message: string;
  metricCode?: string;
  sheetIndex?: number;
  rowNumber?: number;
  sourceIndex?: number;
}

export interface ValidationResultData {
  version: number;
  totalErrorCount: number;
  truncated: boolean;
  errors: ValidationIssue[];
  statementType: string | null;
}

export interface ValidationResponse {
  importJobId: string;
  status: string;
  valid: boolean;
  totalErrorCount: number;
  truncated: boolean;
  errors: ValidationIssue[];
  statementType: string | null;
}

interface MetricDefinitionInfo {
  code: string;
  label: string;
  category: string;
  statementType: string;
}

interface ValidationObservation {
  metricCode: string;
  category: string;
  statementType: string;
  rawValue: string;
  sheetIndex: number;
  rowNumber: number;
  sourceIndex: number;
}

const DECIMAL_REGEX = /^-?\d+(\.\d{1,6})?$/;
const MAX_FRACTIONAL_DIGITS = 6;
const MAX_TOTAL_DIGITS = 30;
const MAX_DETAILED_ERRORS = 100;

function validateDecimalValue(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!DECIMAL_REGEX.test(trimmed)) {
    return `Value is not a valid financial decimal: ${trimmed}`;
  }

  const fractionalIndex = trimmed.indexOf('.');
  if (fractionalIndex !== -1) {
    const fractionalPart = trimmed.substring(fractionalIndex + 1);
    if (fractionalPart.length > MAX_FRACTIONAL_DIGITS) {
      return `Value exceeds maximum ${MAX_FRACTIONAL_DIGITS} decimal places: ${trimmed}`;
    }
  }

  const digitsOnly = trimmed.replace(/^-/, '').replace('.', '');
  if (digitsOnly.length > MAX_TOTAL_DIGITS) {
    return `Value exceeds maximum ${MAX_TOTAL_DIGITS} total digits: ${trimmed}`;
  }

  return null;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  async validateImportJob(
    companyId: string,
    importJobId: string,
    actorId: string,
  ): Promise<ValidationResponse> {
    await this.companyAccessService.requireCompanyWrite(
      actorId,
      companyId,
      await this.getActorRole(actorId),
    );

    const importJob = await this.prismaService.prisma.importJob.findFirst({
      where: { id: importJobId, companyId },
      select: {
        id: true,
        status: true,
        mapping: true,
        statementType: true,
      },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    if (importJob.status !== 'MAPPED') {
      throw new BadRequestException(
        `Import job is in state "${importJob.status}" and cannot be validated`,
      );
    }

    const mapping = this.parseMapping(importJob.mapping);
    if (!mapping) {
      throw new BadRequestException('Import job mapping is corrupt or unreadable');
    }

    if (mapping.version !== 1) {
      throw new BadRequestException(
        `Unsupported mapping version: ${mapping.version}`,
      );
    }

    if (mapping.orientation !== 'ROW_ORIENTED') {
      throw new BadRequestException(
        `Unsupported mapping orientation: ${mapping.orientation}`,
      );
    }

    const sheets = mapping.sheets as SheetMapping[];
    const errors: ValidationIssue[] = [];
    let derivedStatementType: string | null = importJob.statementType;

    const metricDefEntries = await this.prismaService.prisma.metricDefinition.findMany({
      select: { code: true, label: true, category: true, statementType: true },
    });

    const metricDefMap = this.buildMetricDefMap(metricDefEntries);

    const rawRows = await this.prismaService.prisma.importRawRow.findMany({
      where: { companyId, importJobId },
      orderBy: [{ sheetIndex: 'asc' }, { rowNumber: 'asc' }],
    });

    const rawRowMap = new Map<string, { sheetIndex: number; rowNumber: number; values: unknown }>();
    for (const row of rawRows) {
      rawRowMap.set(`${row.sheetIndex}:${row.rowNumber}`, {
        sheetIndex: row.sheetIndex,
        rowNumber: row.rowNumber,
        values: row.values,
      });
    }

    const statementTypes = new Set<string>();
    const metricSeenInSheet = new Map<string, Set<string>>();
    const observations: ValidationObservation[] = [];

    for (const sheet of sheets) {
      const sheetIndex = sheet.sheetIndex;
      const valueColumn = sheet.columns.find((c) => c.role === 'VALUE');
      const valueSourceIndex = valueColumn ? valueColumn.sourceIndex : 1;

      for (const rowMapping of sheet.rowMappings) {
        if (rowMapping.status === 'UNKNOWN' || rowMapping.status === 'AMBIGUOUS') {
          errors.push({
            code: 'UNRESOLVED_MAPPING',
            message: `Row ${rowMapping.rowNumber} has unresolved metric mapping (status: ${rowMapping.status})`,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
          });
          continue;
        }

        if (!rowMapping.metricCode) {
          errors.push({
            code: 'UNRESOLVED_MAPPING',
            message: `Row ${rowMapping.rowNumber} has no metric code assigned`,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
          });
          continue;
        }

        const def = this.lookupMetricDef(
          metricDefMap,
          rowMapping.metricCode,
          rowMapping.statementType,
        );

        if (!def) {
          const foundByCode = metricDefMap.get(rowMapping.metricCode);
          if (foundByCode) {
            errors.push({
              code: 'METRIC_STATEMENT_TYPE_MISMATCH',
              message: `Metric "${rowMapping.metricCode}" does not exist for statement type "${rowMapping.statementType}"`,
              metricCode: rowMapping.metricCode,
              sheetIndex,
              rowNumber: rowMapping.rowNumber,
            });
          } else {
            errors.push({
              code: 'METRIC_NOT_FOUND',
              message: `Mapped metric code "${rowMapping.metricCode}" does not exist in metric definitions`,
              metricCode: rowMapping.metricCode,
              sheetIndex,
              rowNumber: rowMapping.rowNumber,
            });
          }
          continue;
        }

        if (def.category) {
          statementTypes.add(def.statementType);
        }

        const rawRowKey = `${sheetIndex}:${rowMapping.rowNumber}`;
        const rawRow = rawRowMap.get(rawRowKey);
        if (!rawRow) {
          errors.push({
            code: 'MISSING_RAW_ROW',
            message: `No staged raw row found at sheetIndex=${sheetIndex}, rowNumber=${rowMapping.rowNumber}`,
            metricCode: rowMapping.metricCode,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
          });
          continue;
        }

        const values = rawRow.values as string[];
        if (!Array.isArray(values)) {
          errors.push({
            code: 'INVALID_RAW_ROW',
            message: `Raw row values at sheetIndex=${sheetIndex}, rowNumber=${rowMapping.rowNumber} is not an array`,
            metricCode: rowMapping.metricCode,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
          });
          continue;
        }

        const rawValue: string =
          valueSourceIndex < values.length ? (values[valueSourceIndex] ?? '') : '';

        if (!def.category) {
          errors.push({
            code: 'MISSING_CATEGORY',
            message: `Metric "${rowMapping.metricCode}" has no category defined`,
            metricCode: rowMapping.metricCode,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
          });
        }

        if (!metricSeenInSheet.has(String(sheetIndex))) {
          metricSeenInSheet.set(String(sheetIndex), new Set());
        }
        const seenInSheet = metricSeenInSheet.get(String(sheetIndex))!;
        if (seenInSheet.has(rowMapping.metricCode)) {
          errors.push({
            code: 'DUPLICATE_METRIC_MAPPING',
            message: `Metric "${rowMapping.metricCode}" is mapped to multiple rows in the same sheet (${sheetIndex})`,
            metricCode: rowMapping.metricCode,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
          });
        }
        seenInSheet.add(rowMapping.metricCode);

        if (rawValue === '') {
          continue;
        }

        const decimalError = validateDecimalValue(rawValue);
        if (decimalError) {
          errors.push({
            code: 'INVALID_VALUE_FORMAT',
            message: decimalError,
            metricCode: rowMapping.metricCode,
            sheetIndex,
            rowNumber: rowMapping.rowNumber,
            sourceIndex: valueSourceIndex,
          });
          continue;
        }

        observations.push({
          metricCode: rowMapping.metricCode,
          category: def.category,
          statementType: def.statementType,
          rawValue: rawValue.trim(),
          sheetIndex,
          rowNumber: rowMapping.rowNumber,
          sourceIndex: valueSourceIndex,
        });
      }
    }

    if (statementTypes.size > 1) {
      errors.push({
        code: 'INCONSISTENT_STATEMENT_TYPE',
        message: `Mapped metrics reference multiple statement types: ${Array.from(statementTypes).sort().join(', ')}`,
      });
    }

    const errorCount = errors.length;
    const truncated = errorCount > MAX_DETAILED_ERRORS;
    const detailedErrors = truncated
      ? errors.slice(0, MAX_DETAILED_ERRORS)
      : errors;

    const resultData: ValidationResultData = {
      version: 1,
      totalErrorCount: errorCount,
      truncated,
      errors: detailedErrors,
      statementType:
        derivedStatementType ??
        (statementTypes.size === 1 ? Array.from(statementTypes)[0] : null),
    };

    if (errorCount > 0) {
      await this.persistValidationErrors(importJobId, companyId, resultData);
      const actorEmail = await this.getActorEmail(actorId);
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: await this.getActorRole(actorId),
        companyId,
        action: AuditAction.INGEST_VALIDATED,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: importJobId,
        result: AuditResult.FAILURE,
        failureReason: `${errorCount} validation error(s)`,
        metadata: { totalErrorCount: errorCount, truncated, statementType: resultData.statementType },
      });
      return {
        importJobId,
        status: 'MAPPED',
        valid: false,
        totalErrorCount: errorCount,
        truncated,
        errors: detailedErrors,
        statementType: resultData.statementType,
      };
    }

    await this.persistValidationSuccess(importJobId, companyId, resultData);
    const actorEmail = await this.getActorEmail(actorId);
    await this.auditService.record({
      actorType: AuditActorType.USER,
      actorUserId: actorId,
      actorEmail,
      actorGlobalRole: await this.getActorRole(actorId),
      companyId,
      action: AuditAction.INGEST_VALIDATED,
      resourceType: AuditResourceType.IMPORT_JOB,
      resourceId: importJobId,
      result: AuditResult.SUCCESS,
      metadata: { statementType: resultData.statementType },
    });
    return {
      importJobId,
      status: 'VALIDATED',
      valid: true,
      totalErrorCount: 0,
      truncated: false,
      errors: [],
      statementType: resultData.statementType,
    };
  }

  private parseMapping(mapping: unknown): { version: number; orientation: string; sheets: SheetMapping[] } | null {
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
      sheets: m.sheets as SheetMapping[],
    };
  }

  private buildMetricDefMap(
    entries: MetricDefinitionInfo[],
  ): Map<string, Map<string, MetricDefinitionInfo>> {
    const map = new Map<string, Map<string, MetricDefinitionInfo>>();
    for (const def of entries) {
      if (!map.has(def.code)) {
        map.set(def.code, new Map());
      }
      map.get(def.code)!.set(def.statementType, def);
    }
    return map;
  }

  private lookupMetricDef(
    metricDefMap: Map<string, Map<string, MetricDefinitionInfo>>,
    code: string,
    statementType: string | null,
  ): MetricDefinitionInfo | null {
    const defs = metricDefMap.get(code);
    if (!defs) {
      return null;
    }
    if (statementType) {
      return defs.get(statementType) ?? null;
    }
    return defs.values().next().value ?? null;
  }

  private async persistValidationErrors(
    importJobId: string,
    companyId: string,
    data: ValidationResultData,
  ): Promise<void> {
    const result = await this.prismaService.prisma.importJob.updateMany({
      where: { id: importJobId, companyId, status: 'MAPPED' },
      data: { validationErrors: data as any },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'Import job was modified by another request; retry validation',
      );
    }
  }

  private async persistValidationSuccess(
    importJobId: string,
    companyId: string,
    data: ValidationResultData,
  ): Promise<void> {
    const result = await this.prismaService.prisma.importJob.updateMany({
      where: { id: importJobId, companyId, status: 'MAPPED' },
      data: {
        status: 'VALIDATED',
        validationErrors: null as any,
        ...(data.statementType ? { statementType: data.statementType as any } : {}),
      },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'Import job was modified by another request; retry validation',
      );
    }
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
