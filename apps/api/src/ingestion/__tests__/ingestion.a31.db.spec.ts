import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalFileStorageService } from '../storage/local-file-storage.service';
import { IngestionService } from '../ingestion.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

describe('Ingestion A3.1 integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let storageService: LocalFileStorageService;
  let ingestionService: IngestionService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;
  let tempRoot: string;
  let originalStorageRoot: string | undefined;

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-a31-'));
    originalStorageRoot = process.env.INGESTION_STORAGE_ROOT;
    process.env.INGESTION_STORAGE_ROOT = tempRoot;

    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        IngestionService,
        LocalFileStorageService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get<LocalFileStorageService>(LocalFileStorageService);
    ingestionService = module.get<IngestionService>(IngestionService);
    mockCompanyAccessService = module.get(CompanyAccessService) as jest.Mocked<MockCompanyAccessService>;
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    if (originalStorageRoot !== undefined) {
      process.env.INGESTION_STORAGE_ROOT = originalStorageRoot;
    } else {
      delete process.env.INGESTION_STORAGE_ROOT;
    }
    try {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  beforeEach(async () => {
    await prisma.onModuleInit();
    mockCompanyAccessService.requireCompanyWrite = jest.fn();
    mockCompanyAccessService.requireCompanyRead = jest.fn();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('successful CSV upload', () => {
    it('should create SourceFile and ImportJob with correct fields', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'A31 Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('header1,header2\nvalue1,value2');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');

      const response = await ingestionService.upload(company.id, {
        buffer: csvBuffer,
        size: csvBuffer.length,
        originalname: 'test.csv',
        mimetype: 'text/csv',
      }, 'test.csv', user.id);

      expect(response.importJobId).toBeDefined();
      expect(response.sourceFileId).toBeDefined();
      expect(response.status).toBe('UPLOADED');
      expect(response.statementType).toBeNull();
      expect(response.originalFilename).toBe('test.csv');
      expect(response.mimeType).toBe('text/csv');
      expect(response.sizeBytes).toBe(csvBuffer.length);
      expect(response.sha256).toBe(expectedSha256);
      expect(response).not.toHaveProperty('storageKey');
      expect(response).not.toHaveProperty('uploadedBy');
      expect(response).not.toHaveProperty('createdBy');

      const sourceFile = await prisma.prisma.sourceFile.findUnique({
        where: { id: response.sourceFileId },
      });
      expect(sourceFile).toBeDefined();
      expect(sourceFile!.companyId).toBe(company.id);
      expect(sourceFile!.storageKey).toBe(`imports/${company.id}/${response.sourceFileId}`);
      expect(sourceFile!.mimeType).toBe('text/csv');
      expect(sourceFile!.sizeBytes).toBe(csvBuffer.length);
      expect(sourceFile!.sha256).toBe(expectedSha256);
      expect(sourceFile!.uploadedBy).toBe(user.id);
      expect(sourceFile!.status).toBe('UPLOADED');

      const importJob = await prisma.prisma.importJob.findUnique({
        where: { id: response.importJobId },
      });
      expect(importJob).toBeDefined();
      expect(importJob!.companyId).toBe(company.id);
      expect(importJob!.sourceFileId).toBe(sourceFile!.id);
      expect(importJob!.statementType).toBeNull();
      expect(importJob!.createdBy).toBe(user.id);
      expect(importJob!.status).toBe('UPLOADED');

      const storedBytes = await storageService.read(sourceFile!.storageKey);
      expect(storedBytes).toEqual(csvBuffer);

      const verified = await storageService.verify(sourceFile!.storageKey, expectedSha256);
      expect(verified).toBe(true);

      await prisma.prisma.importJob.delete({ where: { id: importJob!.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile!.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('same-company duplicate', () => {
    it('should return 409 and preserve original storage', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Dup Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('header1,header2\nvalue1,value2');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');

      const firstResponse = await ingestionService.upload(company.id, {
        buffer: csvBuffer,
        size: csvBuffer.length,
        originalname: 'test.csv',
        mimetype: 'text/csv',
      }, 'test.csv', user.id);

      const firstStorageKey = `imports/${company.id}/${firstResponse.sourceFileId}`;
      expect(await storageService.exists(firstStorageKey)).toBe(true);

      await expect(
        ingestionService.upload(company.id, {
          buffer: csvBuffer,
          size: csvBuffer.length,
          originalname: 'test2.csv',
          mimetype: 'text/csv',
        }, 'test2.csv', user.id)
      ).rejects.toThrow('Duplicate file');

      const sourceFiles = await prisma.prisma.sourceFile.findMany({
        where: { companyId: company.id, sha256: expectedSha256 },
      });
      expect(sourceFiles).toHaveLength(1);

      const importJobs = await prisma.prisma.importJob.findMany({
        where: { companyId: company.id },
      });
      expect(importJobs).toHaveLength(1);

      expect(await storageService.exists(firstStorageKey)).toBe(true);

      await prisma.prisma.importJob.delete({ where: { id: firstResponse.importJobId } });
      await prisma.prisma.sourceFile.delete({ where: { id: firstResponse.sourceFileId } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('transaction rollback', () => {
    it('should not create SourceFile or ImportJob when transaction fails', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Rollback Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      const csvBuffer = Buffer.from('header1,header2\nvalue1,value2');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');

      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      try {
        await prisma.prisma.$transaction(async (tx) => {
          const sourceFile = await tx.sourceFile.create({
            data: {
              id: uniqueId('source'),
              companyId: company.id,
              originalFilename: 'rollback.csv',
              storageKey,
              mimeType: 'text/csv',
              sizeBytes: csvBuffer.length,
              sha256: expectedSha256,
              uploadedBy: user.id,
              status: 'UPLOADED',
            },
          });

          await tx.importJob.create({
            data: {
              companyId: company.id,
              sourceFileId: sourceFile.id,
              statementType: null,
              status: 'UPLOADED',
              createdBy: user.id,
            },
          });

          throw new Error('Simulated transaction failure');
        });
      } catch {
        // expected
      }

      const sourceFiles = await prisma.prisma.sourceFile.findMany({
        where: { companyId: company.id },
      });
      expect(sourceFiles).toHaveLength(0);

      const importJobs = await prisma.prisma.importJob.findMany({
        where: { companyId: company.id },
      });
      expect(importJobs).toHaveLength(0);

      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('cross-company identical file', () => {
    it('should allow identical bytes across different companies', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Cross A' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Cross B' },
      });
      const userA = await prisma.prisma.user.create({
        data: { id: uniqueId('user-a'), email: `${uniqueId('email-a')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      const userB = await prisma.prisma.user.create({
        data: { id: uniqueId('user-b'), email: `${uniqueId('email-b')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: userA.id, companyId: companyA.id, role: 'OWNER' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: userB.id, companyId: companyB.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('header1,header2\nvalue1,value2');

      const responseA = await ingestionService.upload(companyA.id, {
        buffer: csvBuffer,
        size: csvBuffer.length,
        originalname: 'test.csv',
        mimetype: 'text/csv',
      }, 'test.csv', userA.id);

      const responseB = await ingestionService.upload(companyB.id, {
        buffer: csvBuffer,
        size: csvBuffer.length,
        originalname: 'test.csv',
        mimetype: 'text/csv',
      }, 'test.csv', userB.id);

      expect(responseA.sourceFileId).not.toBe(responseB.sourceFileId);
      expect(responseA.importJobId).not.toBe(responseB.importJobId);

      const sourceFileA = await prisma.prisma.sourceFile.findUnique({
        where: { id: responseA.sourceFileId },
      });
      const sourceFileB = await prisma.prisma.sourceFile.findUnique({
        where: { id: responseB.sourceFileId },
      });

      expect(sourceFileA!.companyId).toBe(companyA.id);
      expect(sourceFileB!.companyId).toBe(companyB.id);
      expect(sourceFileA!.sha256).toBe(sourceFileB!.sha256);

      const importJobA = await prisma.prisma.importJob.findUnique({
        where: { id: responseA.importJobId },
      });
      const importJobB = await prisma.prisma.importJob.findUnique({
        where: { id: responseB.importJobId },
      });

      expect(importJobA!.sourceFileId).toBe(sourceFileA!.id);
      expect(importJobB!.sourceFileId).toBe(sourceFileB!.id);

      await prisma.prisma.importJob.delete({ where: { id: importJobA!.id } });
      await prisma.prisma.importJob.delete({ where: { id: importJobB!.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFileA!.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFileB!.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userA.id, companyId: companyA.id } } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } });
      await prisma.prisma.user.delete({ where: { id: userA.id } });
      await prisma.prisma.user.delete({ where: { id: userB.id } });
      await prisma.prisma.company.delete({ where: { id: companyA.id } });
      await prisma.prisma.company.delete({ where: { id: companyB.id } });
    });
  });

  describe('authorization order', () => {
    it('should not create storage or DB records when company write is denied', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Viewer Co' },
      });
      const owner = await prisma.prisma.user.create({
        data: { id: uniqueId('owner'), email: `${uniqueId('email-owner')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      const viewer = await prisma.prisma.user.create({
        data: { id: uniqueId('viewer'), email: `${uniqueId('email-viewer')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: owner.id, companyId: company.id, role: 'OWNER' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: viewer.id, companyId: company.id, role: 'VIEWER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockRejectedValue(new Error('Forbidden'));

      const csvBuffer = Buffer.from('header1,header2\nvalue1,value2');
      const initialSourceFileCount = await prisma.prisma.sourceFile.count();
      const initialStorageCount = (await fs.promises.readdir(tempRoot)).length;

      await expect(
        ingestionService.upload(company.id, {
          buffer: csvBuffer,
          size: csvBuffer.length,
          originalname: 'test.csv',
          mimetype: 'text/csv',
        }, 'test.csv', viewer.id)
      ).rejects.toThrow('Forbidden');

      const afterSourceFileCount = await prisma.prisma.sourceFile.count();
      const afterStorageCount = (await fs.promises.readdir(tempRoot)).length;

      expect(afterSourceFileCount).toBe(initialSourceFileCount);
      expect(afterStorageCount).toBe(initialStorageCount);

      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: viewer.id, companyId: company.id } } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: owner.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: viewer.id } });
      await prisma.prisma.user.delete({ where: { id: owner.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });
});
