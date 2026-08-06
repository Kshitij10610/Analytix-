import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { AuditActorType, AuditAction, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CsvParser, CsvParseError } from './parsers/csv-parser';
import { XlsxParser, XlsxParseError } from './parsers/xlsx-parser';
import { ParseResponseDto } from './dto/parse-response.dto';
import {
  ParsedTabularFile,
  ParseSummary,
  PARSE_ERROR_CODES,
} from './parsers/parse.types';
import { LocalFileStorageService } from './storage/local-file-storage.service';

@Injectable()
export class ParseService {
  private readonly logger = new Logger(ParseService.name);
  private readonly csvParser: CsvParser;
  private readonly xlsxParser: XlsxParser;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: LocalFileStorageService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {
    this.csvParser = new CsvParser();
    this.xlsxParser = new XlsxParser();
  }

  async parseImportJob(companyId: string, importJobId: string, actorId: string): Promise<ParseResponseDto> {
    const actorRole = await this.getActorRole(actorId);
    await this.companyAccessService.requireCompanyWrite(actorId, companyId, actorRole);

    const importJob = await this.prismaService.prisma.importJob.findFirst({
      where: {
        id: importJobId,
        companyId,
      },
      include: {
        sourceFile: true,
      },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    if (!this.isAllowedParseState(importJob.status)) {
      throw new BadRequestException(`Import job is in state "${importJob.status}" and cannot be parsed`);
    }

    if (importJob.sourceFile.status === 'FAILED') {
      throw new BadRequestException('Source file has failed and cannot be parsed');
    }

    const sourceFile = importJob.sourceFile;

    const integrityValid = await this.storageService.verify(sourceFile.storageKey, sourceFile.sha256);
    if (!integrityValid) {
      this.logger.error(`Source integrity verification failed for company ${companyId}, importJob ${importJobId}`);
      await this.updateJobToFailed(importJobId, companyId, {
        code: PARSE_ERROR_CODES.SOURCE_INTEGRITY_FAILED,
        message: 'Source file integrity verification failed',
        detail: 'Stored file hash does not match SourceFile.sha256',
      });
      await this.recordParseFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, sourceFile.sha256, PARSE_ERROR_CODES.SOURCE_INTEGRITY_FAILED);
      throw new BadRequestException('Source file integrity verification failed');
    }

    let buffer: Buffer;
    try {
      buffer = await this.storageService.read(sourceFile.storageKey);
    } catch (error) {
      this.logger.error(`Failed to read source file for company ${companyId}, importJob ${importJobId}: ${(error as Error).message}`);
      await this.updateJobToFailed(importJobId, companyId, {
        code: PARSE_ERROR_CODES.SOURCE_FILE_MISSING,
        message: 'Source file could not be read',
        detail: error instanceof Error ? error.message : 'Unknown storage error',
      });
      await this.recordParseFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, sourceFile.sha256, PARSE_ERROR_CODES.SOURCE_FILE_MISSING);
      throw new BadRequestException('Source file could not be read');
    }

    if (!buffer || buffer.length === 0) {
      await this.updateJobToFailed(importJobId, companyId, {
        code: PARSE_ERROR_CODES.EMPTY_FILE,
        message: 'Source file is empty',
      });
      await this.recordParseFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, sourceFile.sha256, PARSE_ERROR_CODES.EMPTY_FILE);
      throw new BadRequestException('Source file is empty');
    }

    const mimeType = sourceFile.mimeType;
    let parsedResult: ParsedTabularFile;

    try {
      if (mimeType === 'text/csv') {
        parsedResult = await this.csvParser.parse(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        parsedResult = await this.xlsxParser.parse(buffer);
      } else {
        await this.updateJobToFailed(importJobId, companyId, {
          code: PARSE_ERROR_CODES.UNSUPPORTED_SOURCE_TYPE,
          message: 'Unsupported source file type',
          detail: `MIME type "${mimeType}" is not supported`,
        });
        await this.recordParseFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, sourceFile.sha256, PARSE_ERROR_CODES.UNSUPPORTED_SOURCE_TYPE);
        throw new BadRequestException('Unsupported source file type');
      }
    } catch (error) {
      if (error instanceof CsvParseError || error instanceof XlsxParseError) {
        const parseError = error as CsvParseError | XlsxParseError;
        await this.updateJobToFailed(importJobId, companyId, {
          code: parseError.code,
          message: parseError.message,
          detail: parseError.detail,
        });
        await this.recordParseFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, sourceFile.sha256, parseError.code);
        throw new BadRequestException(parseError.message);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Parser internal error for company ${companyId}, importJob ${importJobId}: ${(error as Error).message}`);
      await this.updateJobToFailed(importJobId, companyId, {
        code: PARSE_ERROR_CODES.PARSER_INTERNAL_ERROR,
        message: 'Parser encountered an internal error',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.recordParseFailure(companyId, importJobId, actorId, actorRole, importJob.sourceFile.id, sourceFile.sha256, PARSE_ERROR_CODES.PARSER_INTERNAL_ERROR);
      throw new BadRequestException('Parser encountered an internal error');
    }

    const parseSummary = this.buildParseSummary(parsedResult);

    const updated = await this.prismaService.prisma.importJob.updateMany({
      where: {
        id: importJobId,
        companyId,
        status: 'UPLOADED',
      },
      data: {
        status: 'PARSED',
        parseSummary: parseSummary as any,
      },
    });

    if (updated.count !== 1) {
      this.logger.warn(`Concurrent parse conflict for company ${companyId}, importJob ${importJobId}`);
      throw new BadRequestException('Import job was modified by another request');
    }

    await this.recordParseEvent(companyId, importJobId, actorId, actorRole, sourceFile.sha256);

    return {
      importJobId,
      status: 'PARSED',
      parseSummary,
    };
  }

  private async recordParseEvent(companyId: string, importJobId: string, actorId: string, actorRole: string, sourceFileSha256: string): Promise<void> {
    try {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_PARSED,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: importJobId,
        result: AuditResult.SUCCESS,
        metadata: {
          sourceFileSha256: sourceFileSha256,
        },
      });
    } catch {
      // Audit recording is best-effort; don't fail the primary operation
    }
  }

  private async recordParseFailure(companyId: string, importJobId: string, actorId: string, actorRole: string, sourceFileId: string, sourceFileSha256: string, errorCode: string): Promise<void> {
    try {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_PARSE_FAILURE,
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

  private async updateJobToFailed(importJobId: string, companyId: string, error: { code: string; message: string; detail?: string }): Promise<void> {
    try {
      await this.prismaService.prisma.importJob.updateMany({
        where: {
          id: importJobId,
          companyId,
          status: 'UPLOADED',
        },
        data: {
          status: 'FAILED',
          parseSummary: {
            version: 1,
            format: 'UNKNOWN',
            success: false,
            sheetCount: 0,
            sheets: [],
            totalDataRows: 0,
            maxColumns: 0,
            emptySheetCount: 0,
            formulaCellCount: 0,
            parsedAt: new Date().toISOString(),
            error,
          },
        },
      });
    } catch (dbError) {
      this.logger.error(`Failed to update ImportJob to FAILED for company ${companyId}, importJob ${importJobId}: ${(dbError as Error).message}`);
    }
  }

  private buildParseSummary(result: ParsedTabularFile): ParseSummary {
    const totalDataRows = result.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    const maxColumns = result.sheets.reduce((max, sheet) => Math.max(max, sheet.headers.length), 0);

    return {
      version: 1,
      format: result.format,
      success: true,
      sheetCount: result.sheets.length,
      sheets: result.sheets.map(sheet => ({
        name: sheet.name,
        headerCount: sheet.headers.length,
        dataRowCount: sheet.rows.length,
      })),
      totalDataRows,
      maxColumns,
      emptySheetCount: 0,
      formulaCellCount: 0,
      parsedAt: new Date().toISOString(),
    };
  }

  private isAllowedParseState(status: string): boolean {
    return status === 'UPLOADED';
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
