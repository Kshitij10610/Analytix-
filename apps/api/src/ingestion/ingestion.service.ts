import * as crypto from 'crypto';
import * as path from 'path';
import { Injectable, BadRequestException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { AuditAction, AuditActorType, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { IngestionFile } from './ingestion.controller';
import { LocalFileStorageService } from './storage/local-file-storage.service';

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly maxUploadBytes: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: LocalFileStorageService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {
    const envMax = process.env.INGESTION_MAX_UPLOAD_BYTES;
    const parsed = envMax ? parseInt(envMax, 10) : NaN;
    this.maxUploadBytes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
  }

  async upload(companyId: string, file: IngestionFile, originalFilename: string, actorId: string): Promise<UploadResponseDto> {
    const actorRole = await this.getActorRole(actorId);
    const actorEmail = await this.getActorEmail(actorId);

    if (!file || !file.buffer || file.buffer.length === 0) {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.SOURCE_FILE,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'Missing file',
        metadata: { companyId, filename: originalFilename ?? null },
      });
      throw new BadRequestException('Missing file');
    }

    await this.companyAccessService.requireCompanyWrite(actorId, companyId, actorRole);

    if (file.size > this.maxUploadBytes) {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.SOURCE_FILE,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'File exceeds maximum allowed size',
        metadata: { companyId, size: file.size, max: this.maxUploadBytes },
      });
      throw new BadRequestException('File exceeds maximum allowed size');
    }

    const safeFilename = this.sanitizeFilename(originalFilename);
    if (!safeFilename) {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.SOURCE_FILE,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'Invalid filename',
        metadata: { companyId, originalFilename },
      });
      throw new BadRequestException('Invalid filename');
    }

    const extension = path.extname(safeFilename).toLowerCase();
    if (!this.isSupportedExtension(extension)) {
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.SOURCE_FILE,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'Unsupported file type',
        metadata: { companyId, extension },
      });
      throw new BadRequestException('Unsupported file type');
    }

    const buffer = file.buffer;
    this.validateFileContent(buffer, extension);

    const sourceFileId = crypto.randomUUID();
    const storageKey = this.buildStorageKey(companyId, sourceFileId);
    const mimeType = extension === '.csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    let storageResult;
    try {
      storageResult = await this.storageService.write(storageKey, buffer);
    } catch (error) {
      this.logger.error(`Storage write failed for company ${companyId}: ${(error as Error).message}`);
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.SOURCE_FILE,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'Storage write failed',
        metadata: { companyId, error: (error as Error).message },
      });
      throw new BadRequestException('Unable to store file');
    }

    try {
      const verified = await this.storageService.verify(storageResult.storageKey, storageResult.sha256);
      if (!verified) {
        await this.storageService.delete(storageResult.storageKey).catch(() => { });
        this.logger.error(`Storage verification failed for company ${companyId}`);
        await this.auditService.record({
          actorType: AuditActorType.USER,
          actorUserId: actorId,
          actorEmail,
          actorGlobalRole: actorRole,
          companyId,
          action: AuditAction.INGEST_FAILURE,
          resourceType: AuditResourceType.SOURCE_FILE,
          resourceId: undefined,
          result: AuditResult.FAILURE,
          failureReason: 'File integrity verification failed',
          metadata: { companyId, sha256: storageResult.sha256 },
        });
        throw new BadRequestException('File integrity verification failed');
      }
    } catch (error) {
      await this.storageService.delete(storageResult.storageKey).catch(() => { });
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.SOURCE_FILE,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'Storage verification error',
        metadata: { companyId, error: (error as Error).message },
      });
      throw error;
    }

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const sourceFile = await tx.sourceFile.create({
          data: {
            id: sourceFileId,
            companyId,
            originalFilename: safeFilename,
            storageKey: storageResult.storageKey,
            mimeType,
            sizeBytes: storageResult.sizeBytes,
            sha256: storageResult.sha256,
            uploadedBy: actorId,
            status: 'UPLOADED',
          },
        });

        const importJob = await tx.importJob.create({
          data: {
            companyId,
            sourceFileId: sourceFile.id,
            statementType: null,
            status: 'UPLOADED',
            createdBy: actorId,
          },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: actorId,
          actorEmail,
          actorGlobalRole: actorRole,
          companyId,
          action: AuditAction.INGEST_UPLOAD,
          resourceType: AuditResourceType.IMPORT_JOB,
          resourceId: importJob.id,
          result: AuditResult.SUCCESS,
          metadata: {
            sourceFileId: sourceFile.id,
            originalFilename: safeFilename,
            sizeBytes: storageResult.sizeBytes,
            sha256: storageResult.sha256,
            mimeType,
          },
        }, tx as any);

        return {
          importJobId: importJob.id,
          sourceFileId: sourceFile.id,
          status: 'UPLOADED' as const,
          statementType: null,
          originalFilename: sourceFile.originalFilename,
          mimeType: sourceFile.mimeType,
          sizeBytes: sourceFile.sizeBytes,
          sha256: sourceFile.sha256,
          uploadedAt: sourceFile.uploadedAt,
        };
      });
    } catch (error) {
      await this.storageService.delete(storageResult.storageKey).catch((cleanupError) => {
        this.logger.error(`Compensation delete failed for company ${companyId}, storageKey ${storageResult.storageKey}: ${(cleanupError as Error).message}`);
      });
      this.logger.error(`Database transaction failed for company ${companyId}: ${(error as Error).message}`, error.stack);
      await this.auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: actorId,
        actorEmail,
        actorGlobalRole: actorRole,
        companyId,
        action: AuditAction.INGEST_FAILURE,
        resourceType: AuditResourceType.IMPORT_JOB,
        resourceId: undefined,
        result: AuditResult.FAILURE,
        failureReason: 'Unable to create import record',
        metadata: { companyId, error: (error as Error).message },
      });

      const prismaError = error as { code?: string; meta?: { target?: string[]; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } };
      const rawFields = prismaError.meta?.driverAdapterError?.cause?.constraint?.fields ?? prismaError.meta?.target;
      const constraintFields = rawFields?.map((field) => field.replace(/"/g, ''));
      if (prismaError.code === 'P2002' && constraintFields?.includes('companyId') && constraintFields.includes('sha256')) {
        throw new ConflictException('Duplicate file');
      }

      throw new BadRequestException('Unable to create import record');
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

  private sanitizeFilename(originalFilename: string): string {
    if (!originalFilename || typeof originalFilename !== 'string') {
      return '';
    }

    if (originalFilename.includes('\0')) {
      return '';
    }

    if (originalFilename.includes('..')) {
      return '';
    }

    let sanitized = originalFilename.replace(/\\/g, '/');
    sanitized = path.basename(sanitized);
    sanitized = sanitized.trim();

    const extension = path.extname(sanitized);
    const baseName = path.basename(sanitized, extension);
    const maxBaseLength = Math.max(0, 255 - extension.length);
    const truncatedBase = baseName.length > maxBaseLength ? baseName.slice(0, maxBaseLength) : baseName;
    sanitized = truncatedBase + extension;

    return sanitized;
  }

  private isSupportedExtension(extension: string): boolean {
    return extension === '.csv' || extension === '.xlsx';
  }

  private validateFileContent(buffer: Buffer, extension: string): void {
    if (buffer.length === 0) {
      throw new BadRequestException('File is empty');
    }

    if (buffer.includes(0)) {
      throw new BadRequestException('File contains null bytes');
    }

    if (extension === '.csv') {
      const text = buffer.toString('utf-8');
      if (text.includes('\uFFFD')) {
        throw new BadRequestException('Invalid CSV encoding');
      }
    }

    if (extension === '.xlsx') {
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        throw new BadRequestException('Invalid XLSX format');
      }

      const sample = buffer.subarray(0, Math.min(65536, buffer.length)).toString('utf-8', 0);
      if (!sample.includes('[Content_Types].xml') || !sample.includes('xl/')) {
        throw new BadRequestException('Invalid XLSX container');
      }
    }
  }

  private buildStorageKey(companyId: string, sourceFileId: string): string {
    return `imports/${companyId}/${sourceFileId}`;
  }
}
