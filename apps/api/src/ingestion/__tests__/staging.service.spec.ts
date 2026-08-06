import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StagingService } from '../staging.service';
import { MappingService } from '../mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
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
  verify = jest.fn();
  exists = jest.fn();
  write = jest.fn();
  delete = jest.fn();
}

describe('StagingService', () => {
  let service: StagingService;
  let mappingService: MappingService;
  let mockCompanyAccessService: MockCompanyAccessService;
  let mockStorageService: MockStorageService;
  let mockPrisma: any;
  let mockTx: any;

  beforeEach(async () => {
     mockCompanyAccessService = new MockCompanyAccessService();
    mockStorageService = new MockStorageService();
    const mockAuditService = new MockAuditService();
    mockTx = {
      importJob: { findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
      importRawRow: { count: jest.fn(), createMany: jest.fn() },
      metricDefinition: { findMany: jest.fn() },
    };
    mockPrisma = {
      user: { findUnique: jest.fn() },
      importJob: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
      importRawRow: { count: jest.fn(), createMany: jest.fn() },
      metricDefinition: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    mappingService = {
      generateMapping: jest.fn(),
    } as unknown as MappingService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: StagingService, useClass: StagingService },
        { provide: PrismaService, useValue: { prisma: mockPrisma } },
        { provide: LocalFileStorageService, useValue: mockStorageService },
        { provide: CompanyAccessService, useValue: mockCompanyAccessService },
        { provide: MappingService, useValue: mappingService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StagingService>(StagingService);
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'OWNER' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('stageImportJob - state validation', () => {
    it('rejects non-PARSED state with BadRequestException', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'UPLOADED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });

      await expect(service.stageImportJob('company-1', 'job-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects FAILED source file', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'FAILED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });

      await expect(service.stageImportJob('company-1', 'job-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('stageImportJob - source integrity', () => {
    it('re-verifies source integrity before staging', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });
      mockStorageService.verify.mockResolvedValue(false);

      await expect(service.stageImportJob('company-1', 'job-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(mockStorageService.verify).toHaveBeenCalledWith('key', 'hash');
    });

    it('fails job when integrity verification fails', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'FAILED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });

      await expect(service.stageImportJob('company-1', 'job-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('stageImportJob - re-parsing', () => {
    it('re-reads source bytes and re-parses for staging', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000\nExpenses,500');
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(csvBuffer);

      mockTx.importJob.findFirst.mockResolvedValue({ id: 'job-1', status: 'PARSED' });
      mockTx.importRawRow.count.mockResolvedValue(0);
      mockTx.importRawRow.createMany.mockResolvedValue({ count: 2 });
      mockTx.metricDefinition.findMany.mockResolvedValue([
        { code: 'REVENUE', label: 'Revenue', category: 'Revenue', statementType: 'INCOME_STATEMENT' },
        { code: 'EXPENSES', label: 'Expenses', category: 'Operating Expenses', statementType: 'INCOME_STATEMENT' },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      (mappingService.generateMapping as jest.Mock).mockReturnValue({
        allResolved: true,
        mapping: { version: 1, orientation: 'ROW_ORIENTED', sheets: [] },
      });

      mockTx.importJob.update.mockResolvedValue({ id: 'job-1' });

      const result = await service.stageImportJob('company-1', 'job-1', 'user-1');

      expect(mockStorageService.read).toHaveBeenCalledWith('key');
      expect(mockTx.importRawRow.createMany).toHaveBeenCalled();
      expect(mockTx.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', companyId: 'company-1', status: 'PARSED' },
          data: expect.objectContaining({ status: 'MAPPED' }),
        }),
      );
      expect(result.status).toBe('MAPPED');
    });

    it('rejects already-staged job', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000');
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(csvBuffer);

      mockTx.importJob.findFirst.mockResolvedValue({ id: 'job-1', status: 'PARSED' });
      mockTx.importRawRow.count.mockResolvedValue(5);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await expect(service.stageImportJob('company-1', 'job-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('rejects stale transition when job state changed during staging', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000');
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(csvBuffer);

      mockTx.importJob.findFirst.mockResolvedValue({ id: 'job-1', status: 'UPLOADED' });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await expect(service.stageImportJob('company-1', 'job-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('stageImportJob - source re-verification', () => {
    it('reuses existing parser (CsvParser) for CSV source', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'PARSED',
        sourceFile: { status: 'UPLOADED', storageKey: 'key', sha256: 'hash', mimeType: 'text/csv' },
      });
      mockStorageService.verify.mockResolvedValue(true);
      mockStorageService.read.mockResolvedValue(Buffer.from('a,b\n1,2'));

      mockTx.importJob.findFirst.mockResolvedValue({ id: 'job-1', status: 'PARSED' });
      mockTx.importRawRow.count.mockResolvedValue(0);
      mockTx.importRawRow.createMany.mockResolvedValue({ count: 1 });
      mockTx.metricDefinition.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      (mappingService.generateMapping as jest.Mock).mockReturnValue({
        allResolved: false,
        mapping: { version: 1, orientation: 'ROW_ORIENTED', sheets: [] },
      });
      mockTx.importJob.update.mockResolvedValue({ id: 'job-1' });

      const result = await service.stageImportJob('company-1', 'job-1', 'user-1');

      expect(result.status).toBe('NEEDS_MAPPING');
      expect(mockTx.importRawRow.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ sheetName: 'CSV', sheetIndex: 0, rowNumber: 2, values: ['1', '2'] }),
          ]),
        }),
      );
    });
  });
});
