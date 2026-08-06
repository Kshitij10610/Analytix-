import { Test, TestingModule } from '@nestjs/testing';
import { ParseService } from '../parse.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LocalFileStorageService } from '../storage/local-file-storage.service';

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

class MockAuditService {
  record = jest.fn();
  recordInTransaction = jest.fn();
}

class MockStorageService {
  read = jest.fn();
  write = jest.fn();
  exists = jest.fn();
  delete = jest.fn();
  verify = jest.fn();
}

describe('ParseService', () => {
  let service: ParseService;
  let mockCompanyAccessService: MockCompanyAccessService;
  let mockStorageService: MockStorageService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockCompanyAccessService = new MockCompanyAccessService();
    mockStorageService = new MockStorageService();
    const mockAuditService = new MockAuditService();
    mockPrisma = {
      importJob: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      sourceFile: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParseService,
        { provide: PrismaService, useValue: { prisma: mockPrisma } },
        { provide: CompanyAccessService, useValue: mockCompanyAccessService },
        { provide: LocalFileStorageService, useValue: mockStorageService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ParseService>(ParseService);
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'OWNER' });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('parseImportJob', () => {
    it('should throw ForbiddenException when company write access denied', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when import job does not exist', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue(null);

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject PARSED state', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash' },
      });

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject NEEDS_MAPPING state', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash' },
      });

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject FAILED state', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'FAILED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash' },
      });

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when SourceFile is FAILED', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile: { status: 'FAILED', storageKey: 'key', sha256: 'hash' },
      });

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle integrity verification failure', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash' },
      });
      mockStorageService.verify.mockResolvedValue(false);

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.importJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', companyId: 'company-1', status: 'UPLOADED' },
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });

    it('should handle source read failure', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockRejectedValue(new Error('Storage error'));

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unsupported source type', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'application/pdf' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(Buffer.from('pdf'));

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle stale update conflict', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(Buffer.from('a,b\n1,2'));
      mockPrisma.importJob.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.parseImportJob('company-1', 'job-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should not mutate SourceFile', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      const sourceFile = {
        id: 'source-1',
        companyId: 'company-1',
        storageKey: 'key',
        sha256: 'hash',
        mimeType: 'text/csv',
        status: 'UPLOADED',
      };
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile,
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(Buffer.from('a,b\n1,2'));
      mockPrisma.importJob.updateMany.mockResolvedValue({ count: 1 });

      await service.parseImportJob('company-1', 'job-1', 'user-1');

      expect(mockPrisma.sourceFile.update).not.toHaveBeenCalled();
      expect(mockPrisma.sourceFile.updateMany).not.toHaveBeenCalled();
    });
  });
});
