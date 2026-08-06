import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from '../ingestion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalFileStorageService } from '../storage/local-file-storage.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { IngestionFile } from '../ingestion.controller';

const mockPrisma = {
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
};

  const mockStorage = {
    write: jest.fn(),
    verify: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

const mockCompanyAccess = {
  requireCompanyWrite: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  recordInTransaction: jest.fn().mockResolvedValue({ id: 'audit-1' }),
};

describe('IngestionService', () => {
  let service: IngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocalFileStorageService, useValue: mockStorage },
        { provide: CompanyAccessService, useValue: mockCompanyAccess },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    const companyId = 'company-1';
    const actorId = 'user-1';
    const fileBuffer = Buffer.from('header1,header2\nvalue1,value2');
    const mockFile = {
      buffer: fileBuffer,
      size: fileBuffer.length,
      originalname: 'test.csv',
      mimetype: 'text/csv',
    } as IngestionFile;

    const mockSourceFile = {
      id: 'source-1',
      companyId,
      originalFilename: 'test.csv',
      storageKey: 'imports/company-1/source-1',
      mimeType: 'text/csv',
      sizeBytes: fileBuffer.length,
      sha256: 'abc123',
      uploadedBy: actorId,
      status: 'UPLOADED',
      uploadedAt: new Date(),
    };

    const mockImportJob = {
      id: 'job-1',
      companyId,
      sourceFileId: 'source-1',
      statementType: null,
      status: 'UPLOADED',
      createdBy: actorId,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };

    beforeEach(() => {
      mockCompanyAccess.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.prisma.user.findUnique.mockResolvedValue({ id: actorId, role: 'OWNER', email: 'user-1@test.com' });
      mockStorage.write.mockResolvedValue({ storageKey: mockSourceFile.storageKey, sizeBytes: fileBuffer.length, sha256: 'abc123' });
      mockStorage.verify.mockResolvedValue(true);
      mockPrisma.prisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          sourceFile: { create: jest.fn().mockResolvedValue(mockSourceFile) },
          importJob: { create: jest.fn().mockResolvedValue(mockImportJob) },
        } as any);
      });
    });

    it('should reject missing file', async () => {
      await expect(service.upload(companyId, null as any, 'test.csv', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject empty file', async () => {
      const emptyFile = { buffer: Buffer.alloc(0), size: 0, originalname: 'empty.csv', mimetype: 'text/csv' } as IngestionFile;
      await expect(service.upload(companyId, emptyFile, 'empty.csv', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject oversized file', async () => {
      const hugeBuffer = Buffer.alloc(1024, 'x');
      const hugeFile = { buffer: hugeBuffer, size: hugeBuffer.length, originalname: 'big.csv', mimetype: 'text/csv' } as IngestionFile;
      process.env.INGESTION_MAX_UPLOAD_BYTES = '100';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          IngestionService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: LocalFileStorageService, useValue: mockStorage },
          { provide: CompanyAccessService, useValue: mockCompanyAccess },
          { provide: AuditService, useValue: mockAuditService },
        ],
      }).compile();
      const sizedService = module.get<IngestionService>(IngestionService);
      await expect(sizedService.upload(companyId, hugeFile, 'big.csv', actorId)).rejects.toThrow(BadRequestException);
      delete process.env.INGESTION_MAX_UPLOAD_BYTES;
    });

    it('should reject unsupported extension', async () => {
      const txtFile = { buffer: fileBuffer, size: fileBuffer.length, originalname: 'test.txt', mimetype: 'text/plain' } as IngestionFile;
      await expect(service.upload(companyId, txtFile, 'test.txt', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject .xls extension', async () => {
      const xlsFile = { buffer: fileBuffer, size: fileBuffer.length, originalname: 'test.xls', mimetype: 'application/vnd.ms-excel' } as IngestionFile;
      await expect(service.upload(companyId, xlsFile, 'test.xls', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject null-byte filename', async () => {
      await expect(service.upload(companyId, mockFile, 'test\x00.csv', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject path-like filename', async () => {
      await expect(service.upload(companyId, mockFile, '../../etc/passwd', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject binary disguised as CSV', async () => {
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const binaryFile = { buffer: binaryBuffer, size: binaryBuffer.length, originalname: 'fake.csv', mimetype: 'text/csv' } as IngestionFile;
      await expect(service.upload(companyId, binaryFile, 'fake.csv', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid XLSX container', async () => {
      const fakeXlsx = Buffer.from('PK\x03\x04fake-xlsx-content-without-content-types');
      const fakeFile = { buffer: fakeXlsx, size: fakeXlsx.length, originalname: 'fake.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as IngestionFile;
      await expect(service.upload(companyId, fakeFile, 'fake.xlsx', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should reject non-ZIP XLSX', async () => {
      const txtXlsx = Buffer.from('not-a-zip-file');
      const txtFile = { buffer: txtXlsx, size: txtXlsx.length, originalname: 'fake.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as IngestionFile;
      await expect(service.upload(companyId, txtFile, 'fake.xlsx', actorId)).rejects.toThrow(BadRequestException);
    });

    it('should accept valid CSV and return response', async () => {
      const result = await service.upload(companyId, mockFile, 'test.csv', actorId);
      expect(result.importJobId).toBe('job-1');
      expect(result.sourceFileId).toBe('source-1');
      expect(result.status).toBe('UPLOADED');
      expect(result.statementType).toBeNull();
      expect(result.originalFilename).toBe('test.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.sha256).toBe('abc123');
      expect(mockStorage.write).toHaveBeenCalled();
      expect(mockStorage.verify).toHaveBeenCalledWith('imports/company-1/source-1', 'abc123');
    });

    it('should accept uppercase CSV extension', async () => {
      const upperFile = { buffer: fileBuffer, size: fileBuffer.length, originalname: 'test.CSV', mimetype: 'text/csv' } as IngestionFile;
      const result = await service.upload(companyId, upperFile, 'test.CSV', actorId);
      expect(result.originalFilename).toBe('test.csv');
    });

    it('should reject when company write access is denied', async () => {
      mockCompanyAccess.requireCompanyWrite.mockRejectedValue(new ForbiddenException('Insufficient permissions'));
      await expect(service.upload(companyId, mockFile, 'test.csv', actorId)).rejects.toThrow(ForbiddenException);
      expect(mockStorage.write).not.toHaveBeenCalled();
    });

    it('should clean up storage on DB transaction failure', async () => {
      mockPrisma.prisma.$transaction.mockImplementationOnce(async (fn: any) => {
        throw new Error('DB failure');
      });
      await expect(service.upload(companyId, mockFile, 'test.csv', actorId)).rejects.toThrow(BadRequestException);
      expect(mockStorage.delete).toHaveBeenCalledWith('imports/company-1/source-1');
    });

    it('should clean up storage on verification failure', async () => {
      mockStorage.verify.mockResolvedValueOnce(false);
      await expect(service.upload(companyId, mockFile, 'test.csv', actorId)).rejects.toThrow(BadRequestException);
      expect(mockStorage.delete).toHaveBeenCalledWith('imports/company-1/source-1');
    });

    it('should return conflict for duplicate same-company file', async () => {
      const uniqueError = { code: 'P2002', meta: { target: ['companyId', 'sha256'] } } as any;
      mockPrisma.prisma.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = fn({
          sourceFile: { create: jest.fn().mockRejectedValue(uniqueError) },
          importJob: { create: jest.fn() },
        } as any);
        return tx;
      });
      await expect(service.upload(companyId, mockFile, 'test.csv', actorId)).rejects.toThrow(ConflictException);
      expect(mockStorage.delete).toHaveBeenCalledWith('imports/company-1/source-1');
    });

    it('should not expose storageKey in response', async () => {
      const result = await service.upload(companyId, mockFile, 'test.csv', actorId);
      expect(result).not.toHaveProperty('storageKey');
      expect(result).not.toHaveProperty('uploadedBy');
      expect(result).not.toHaveProperty('createdBy');
    });

    it('should use actual file size in response', async () => {
      const result = await service.upload(companyId, mockFile, 'test.csv', actorId);
      expect(result.sizeBytes).toBe(fileBuffer.length);
    });

    it('should sanitize filename metadata', async () => {
      const windowsPath = 'C:\\fakepath\\file.csv';
      const result = await service.upload(companyId, mockFile, windowsPath, actorId);
      expect(result.originalFilename).toBe('test.csv');
    });

    it('should preserve primary error even when compensation fails', async () => {
      const dbError = new Error('DB failure');
      mockPrisma.prisma.$transaction.mockImplementationOnce(async (fn: any) => {
        throw dbError;
      });
      mockStorage.delete.mockRejectedValueOnce(new Error('delete failed'));
      await expect(service.upload(companyId, mockFile, 'test.csv', actorId)).rejects.toThrow(BadRequestException);
    });
  });
});
