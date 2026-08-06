import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { AuditActorType, AuditAction, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { MappingService, MappingResult } from './mapping.service';
import { CsvParser, CsvParseError } from './parsers/csv-parser';
import { ParsedTabularFile, PARSE_ERROR_CODES } from './parsers/parse.types';
import { XlsxParser, XlsxParseError } from './parsers/xlsx-parser';
import { LocalFileStorageService } from './storage/local-file-storage.service';

export interface StageResponse {
  importJobId: string;
  status: string;
  stagedRowCount: number;
  sheetCount: number;
  mapping: Record<string, unknown>;
}

@Injectable()
export class StagingService {
  private readonly logger = new Logger(StagingService.name);
  private readonly csvParser: CsvParser;
  private readonly xlsxParser: XlsxParser;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: LocalFileStorageService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly mappingService: MappingService,
    private readonly auditService: AuditService,
  ) {
    this.csvParser = new CsvParser();
    this.xlsxParser = new XlsxParser();
  }

  async stageImportJob(companyId: string, importJobId: string, actorId: string): Promise<StageResponse> {
    const actorRole = await this.getActorRole(actorId);
    await this.companyAccessService.requireCompanyWrite(actorId, companyId, actorRole);

    const importJob = await this.prismaService.prisma.importJob.findFirst({
      where: { id: importJobId, companyId },
      include: { sourceFile: true },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    if (importJob.status !== 'PARSED') {
      throw new BadRequestException(`Import job is in state "${importJob.status}" and cannot be staged`);
    }

    if (importJob.sourceFile.status === 'FAILED') {
      throw new BadRequestException('Source file has failed and cannot be staged');
    }

    const integrityValid = await this.storageService.verify(importJob.sourceFile.storageKey, importJob.sourceFile.sha256);
    if (!integrityValid) {
      this.logger.error(`Source integrity verification failed for staging, company ${companyId}, importJob ${importJobId}`);
      await this.failJob(importJobId, companyId, {
        code: PARSE_ERROR_CODES.SOURCE_INTEGRITY_FAILED,
        message: 'Source file integrity verification failed',
        detail: 'Stored file hash does not match SourceFile.sha256',
      });
      await this.recordStageFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, importJob.sourceFile.sha256, PARSE_ERROR_CODES.SOURCE_INTEGRITY_FAILED);
      throw new BadRequestException('Source file integrity verification failed');
    }

    let buffer: Buffer;
    try {
      buffer = await this.storageService.read(importJob.sourceFile.storageKey);
    } catch (error) {
      this.logger.error(`Failed to read source file for staging, company ${companyId}, importJob ${importJobId}: ${(error as Error).message}`);
      await this.failJob(importJobId, companyId, {
        code: PARSE_ERROR_CODES.SOURCE_FILE_MISSING,
        message: 'Source file could not be read',
        detail: error instanceof Error ? error.message : 'Unknown storage error',
      });
      await this.recordStageFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, importJob.sourceFile.sha256, PARSE_ERROR_CODES.SOURCE_FILE_MISSING);
      throw new BadRequestException('Source file could not be read');
    }

    const mimeType = importJob.sourceFile.mimeType;

    let parsedResult: ParsedTabularFile;
    try {
      if (mimeType === 'text/csv') {
        parsedResult = await this.csvParser.parse(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        parsedResult = await this.xlsxParser.parse(buffer);
      } else {
        throw new BadRequestException('Unsupported source file type');
      }
    } catch (error) {
      if (error instanceof CsvParseError || error instanceof XlsxParseError) {
        const parseError = error as CsvParseError | XlsxParseError;
        await this.failJob(importJobId, companyId, {
          code: parseError.code,
          message: parseError.message,
          detail: parseError.detail,
        });
        await this.recordStageFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, importJob.sourceFile.sha256, parseError.code);
        throw new BadRequestException(parseError.message);
      }
      throw error;
    }

    const totalDataRows = parsedResult.sheets.reduce((sum, s) => sum + s.rows.length, 0);

    let mappingResult: MappingResult;

    await this.prismaService.prisma.$transaction(async (tx) => {
      const existing = await tx.importJob.findFirst({
        where: { id: importJobId, companyId },
        select: { status: true },
      });
      if (!existing || existing.status !== 'PARSED') {
        throw new ConflictException('Import job state changed during staging; concurrent operation rejected');
      }

      const existingRows = await tx.importRawRow.count({
        where: { companyId, importJobId },
      });
      if (existingRows > 0) {
        throw new ConflictException('Import job has already been staged');
      }

      const rawRows = this.buildRawRowData(parsedResult, companyId, importJobId);

      await tx.importRawRow.createMany({
        data: rawRows,
        skipDuplicates: true,
      });

      const metricDefinitions = await tx.metricDefinition.findMany({
        select: { code: true, label: true, category: true, statementType: true },
      });

      mappingResult = this.mappingService.generateMapping(parsedResult, metricDefinitions);

      const finalStatus = mappingResult.allResolved ? 'MAPPED' : 'NEEDS_MAPPING';

      await tx.importJob.update({
        where: { id: importJobId, companyId, status: 'PARSED' },
        data: {
          status: finalStatus,
          mapping: mappingResult.mapping as any,
        },
      });
    });

    await this.recordStageEvent(companyId, importJobId, actorId, actorRole, importJob.sourceFile.sha256, mappingResult!.allResolved ? 'MAPPED' : 'NEEDS_MAPPING', totalDataRows);

    return {
      importJobId,
      status: mappingResult!.allResolved ? 'MAPPED' : 'NEEDS_MAPPING',
      stagedRowCount: totalDataRows,
      sheetCount: parsedResult.sheets.length,
      mapping: mappingResult!.mapping,
    };
  }

  private async recordStageEvent(companyId: string, importJobId: string, actorId: string, actorRole: string, sourceFileSha256: string, resultStatus: string, stagedCount: number): Promise<void> {
    try {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_STAGED,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: importJobId,
        result: AuditResult.SUCCESS,
        metadata: {
          sourceFileSha256,
          resultStatus,
          stagedRowCount: stagedCount,
          sheetCount: 0,
        },
      });
    } catch {
      // Audit recording is best-effort; don't fail the primary operation
    }
  }

  private async recordStageFailure(companyId: string, importJobId: string, actorId: string, actorRole: string, sourceFileId: string, sourceFileSha256: string, errorCode: string): Promise<void> {
    try {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_STAGE_FAILURE,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: importJobId,
        result: AuditResult.FAILURE,
        failureReason: errorCode,
        metadata: {
          sourceFileId,
          sourceFileSha256,
        },
      });
    } catch {
      // Audit recording is best-effort; don't fail the primary operation
    }
  }

  private buildRawRowData(
    parsed: ParsedTabularFile,
    companyId: string,
    importJobId: string,
  ): Array<{
    id: string;
    companyId: string;
    importJobId: string;
    sheetName: string;
    sheetIndex: number;
    rowNumber: number;
    values: string[];
  }> {
    const { randomUUID } = require('crypto');
    const rows: Array<{
      id: string;
      companyId: string;
      importJobId: string;
      sheetName: string;
      sheetIndex: number;
      rowNumber: number;
      values: string[];
    }> = [];

    for (let sheetIndex = 0; sheetIndex < parsed.sheets.length; sheetIndex++) {
      const sheet = parsed.sheets[sheetIndex];
      for (const row of sheet.rows) {
        rows.push({
          id: randomUUID(),
          companyId,
          importJobId,
          sheetName: sheet.name,
          sheetIndex,
          rowNumber: row.rowNumber,
          values: row.values,
        });
      }
    }

    return rows;
  }

  private async failJob(importJobId: string, companyId: string, _error: { code: string; message: string; detail?: string }): Promise<void> {
    try {
      await this.prismaService.prisma.importJob.updateMany({
        where: { id: importJobId, companyId, status: 'PARSED' },
        data: {
          status: 'FAILED',
        },
      });
    } catch (dbError) {
      this.logger.error(`Failed to update ImportJob to FAILED for company ${companyId}, importJob ${importJobId}: ${(dbError as Error).message}`);
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
}
