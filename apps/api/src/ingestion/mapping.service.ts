import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditActorType, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParsedTabularFile } from './parsers/parse.types';

export type MappingStatus = 'AUTO_MAPPED' | 'AMBIGUOUS' | 'UNKNOWN' | 'USER_CONFIRMED';
export type ColumnRole = 'METRIC_LABEL' | 'VALUE' | 'UNKNOWN';

export interface RowMapping {
  rowNumber: number;
  sourceLabel: string;
  metricCode: string | null;
  statementType: string | null;
  status: MappingStatus;
  candidates: Array<{ code: string; label: string; category: string; statementType: string }>;
}

export interface ColumnMapping {
  sourceIndex: number;
  sourceHeader: string;
  role: ColumnRole;
  status: MappingStatus;
}

export interface SheetMapping {
  sheetIndex: number;
  sheetName: string;
  headers: string[];
  columns: ColumnMapping[];
  rowMappings: RowMapping[];
}

export interface MappingResult {
  allResolved: boolean;
  mapping: Record<string, unknown>;
}

export interface MetricDefinitionInfo {
  code: string;
  label: string;
  category: string;
  statementType: string;
}

export interface MappingConfirmRequest {
  statementType?: string;
  sheets: Array<{
    sheetIndex: number;
    rowMappings: Array<{
      rowNumber: number;
      metricCode: string;
    }>;
  }>;
}

export interface MappingConfirmResponse {
  importJobId: string;
  status: string;
  mapping: Record<string, unknown>;
}

const NORMALIZE_PATTERN = /[\s_\-]+/g;

function normalizeForMatch(input: string): string {
  return input.trim().toLowerCase().replace(NORMALIZE_PATTERN, ' ').trim();
}

@Injectable()
export class MappingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  generateMapping(
    parsed: ParsedTabularFile,
    metricDefs: MetricDefinitionInfo[],
  ): MappingResult {
    const sheets: SheetMapping[] = [];

    for (let sheetIndex = 0; sheetIndex < parsed.sheets.length; sheetIndex++) {
      const sheet = parsed.sheets[sheetIndex];
      const headers = [...sheet.headers];

      const columns: ColumnMapping[] = headers.map((h, idx) => ({
        sourceIndex: idx,
        sourceHeader: h,
        role: idx === 0 ? 'METRIC_LABEL' : 'VALUE',
        status: 'RESOLVED' as MappingStatus,
      }));

      const rowMappings: RowMapping[] = [];

      for (const row of sheet.rows) {
        const labelValue = row.values[0] ?? '';
        const normInput = normalizeForMatch(labelValue);

        const matches: MetricDefinitionInfo[] = [];
        const seenKeys = new Set<string>();

        for (const def of metricDefs) {
          const normCode = normalizeForMatch(def.code);
          const normLabel = normalizeForMatch(def.label);

          if (normCode === normInput || normLabel === normInput) {
            const key = def.code + '|' + def.statementType;
            if (!seenKeys.has(key)) {
              matches.push(def);
              seenKeys.add(key);
            }
          }
        }

        let status: MappingStatus;
        let matchedCode: string | null = null;
        let matchedStatementType: string | null = null;

        if (matches.length === 1) {
          status = 'AUTO_MAPPED';
          matchedCode = matches[0].code;
          matchedStatementType = matches[0].statementType;
        } else if (matches.length > 1) {
          status = 'AMBIGUOUS';
          const uniqueCodes = new Set(matches.map((m) => m.code));
          if (uniqueCodes.size === 1) {
            matchedCode = uniqueCodes.values().next().value;
          }
        } else {
          status = 'UNKNOWN';
        }

        rowMappings.push({
          rowNumber: row.rowNumber,
          sourceLabel: labelValue,
          metricCode: matchedCode,
          statementType: matchedStatementType,
          status,
          candidates: matches,
        });
      }

      sheets.push({
        sheetIndex,
        sheetName: sheet.name,
        headers,
        columns,
        rowMappings,
      });
    }

    const allResolved = sheets.every((s) =>
      s.rowMappings.every((r) => r.status === 'AUTO_MAPPED' || r.status === 'USER_CONFIRMED'),
    );

    const mapping = {
      version: 1,
      orientation: 'ROW_ORIENTED',
      sheets,
    };

    return { allResolved, mapping };
  }

  async confirmMapping(
    companyId: string,
    importJobId: string,
    actorId: string,
    payload: MappingConfirmRequest,
  ): Promise<MappingConfirmResponse> {
    await this.companyAccessService.requireCompanyWrite(actorId, companyId, await this.getActorRole(actorId));

    const importJob = await this.prismaService.prisma.importJob.findFirst({
      where: { id: importJobId, companyId },
      select: { id: true, status: true, mapping: true },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    if (importJob.status !== 'NEEDS_MAPPING') {
      throw new BadRequestException(`Import job is in state "${importJob.status}" and mapping cannot be updated`);
    }

    const existingMapping = (importJob.mapping as Record<string, unknown>) || {};
    const existingSheets = (existingMapping.sheets as SheetMapping[]) || [];

    const sheetIndexMap = new Map<number, SheetMapping>();
    for (const s of existingSheets) {
      sheetIndexMap.set(s.sheetIndex, s);
    }

    for (const sheetUpdate of payload.sheets) {
      const sheet = sheetIndexMap.get(sheetUpdate.sheetIndex);
      if (!sheet) {
        throw new BadRequestException(`Invalid sheetIndex ${sheetUpdate.sheetIndex}`);
      }

    const existingRowMap = new Map<number, RowMapping>();
    for (const r of sheet.rowMappings) {
      existingRowMap.set(r.rowNumber, r);
    }

      const confirmedCodesInSheet = new Set<string>();

      for (const rowMapping of sheetUpdate.rowMappings) {
        const existing = existingRowMap.get(rowMapping.rowNumber);
        if (!existing) {
          throw new BadRequestException(`Invalid rowNumber ${rowMapping.rowNumber} for sheet ${sheetUpdate.sheetIndex}`);
        }

        if (existing.status === 'AUTO_MAPPED') {
          throw new BadRequestException(`Row ${rowMapping.rowNumber} is already auto-mapped`);
        }

        const resolvedStatementType = payload.statementType ?? existing.statementType;
        if (!resolvedStatementType) {
          throw new BadRequestException(
            `Cannot resolve statement type for row ${rowMapping.rowNumber}; provide payload statementType or use an auto-mapped row`,
          );
        }

        const metricDef = await this.prismaService.prisma.metricDefinition.findFirst({
          where: {
            code: rowMapping.metricCode,
            statementType: resolvedStatementType as any,
          },
          select: { code: true, label: true, statementType: true, category: true },
        });

        if (!metricDef) {
          throw new BadRequestException(`Unknown metric code: ${rowMapping.metricCode}`);
        }

        const conflictKey = metricDef.code + '|' + metricDef.statementType;
        if (confirmedCodesInSheet.has(conflictKey)) {
          throw new BadRequestException(`Duplicate metric mapping: ${rowMapping.metricCode}`);
        }
        confirmedCodesInSheet.add(conflictKey);

        existing.metricCode = metricDef.code;
        existing.statementType = metricDef.statementType;
        existing.status = 'USER_CONFIRMED';
        existing.candidates = [{ code: metricDef.code, label: metricDef.label, category: metricDef.category, statementType: metricDef.statementType }];
      }
    }

    const updatedMapping = {
      ...existingMapping,
      sheets: Array.from(sheetIndexMap.values()),
    };

    const allResolved = updatedMapping.sheets.every(
      (s: SheetMapping) =>
        s.rowMappings.every((r) => r.status === 'AUTO_MAPPED' || r.status === 'USER_CONFIRMED'),
    );

    const finalStatus = allResolved ? 'MAPPED' : 'NEEDS_MAPPING';

    await this.prismaService.prisma.$transaction(async (tx) => {
      const updated = await tx.importJob.updateMany({
        where: { id: importJobId, companyId, status: 'NEEDS_MAPPING' },
        data: {
          status: finalStatus,
          mapping: updatedMapping as any,
          ...(payload.statementType
            ? { statementType: payload.statementType as any }
            : {}),
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Import job was modified by another request; retry');
      }

      const actorEmail = await this.getActorEmail(actorId);
      await this.auditService.recordInTransaction({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: await this.getActorRole(actorId),
        companyId,
        action: AuditAction.INGEST_MAPPING_CONFIRMED,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: importJobId,
        result: AuditResult.SUCCESS,
        metadata: { finalStatus, allResolved, statementType: payload.statementType ?? null },
      }, tx as any);
    });

    return {
      importJobId,
      status: finalStatus,
      mapping: updatedMapping,
    };
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
