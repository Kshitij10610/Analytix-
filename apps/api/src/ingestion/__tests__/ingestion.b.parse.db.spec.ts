import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalFileStorageService } from '../storage/local-file-storage.service';
import { ParseService } from '../parse.service';
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

describe('Ingestion B parsing integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let storageService: LocalFileStorageService;
  let parseService: ParseService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;
  let tempRoot: string;
  let originalStorageRoot: string | undefined;

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-b-parse-'));
    originalStorageRoot = process.env.INGESTION_STORAGE_ROOT;
    process.env.INGESTION_STORAGE_ROOT = tempRoot;

    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        ParseService,
        LocalFileStorageService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get<LocalFileStorageService>(LocalFileStorageService);
    parseService = module.get<ParseService>(ParseService);
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

  describe('CSV success', () => {
    it('should transition UPLOADED ImportJob to PARSED with summary', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Parse CSV Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('name,value\nAlice,100\nBob,200');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'test.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: expectedSha256,
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      const response = await parseService.parseImportJob(company.id, importJob.id, user.id);

      expect(response.status).toBe('PARSED');
      expect(response.parseSummary.format).toBe('CSV');
      expect(response.parseSummary.success).toBe(true);
      expect(response.parseSummary.totalDataRows).toBe(2);
      expect(response.parseSummary.maxColumns).toBe(2);
      expect(response.parseSummary.sheetCount).toBe(1);
      expect(response.parseSummary.sheets[0].name).toBe('CSV');
      expect(response.parseSummary.sheets[0].headerCount).toBe(2);
      expect(response.parseSummary.sheets[0].dataRowCount).toBe(2);

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.status).toBe('PARSED');
      expect(updatedJob!.parseSummary).toEqual(response.parseSummary);

      const updatedSourceFile = await prisma.prisma.sourceFile.findUnique({
        where: { id: sourceFile.id },
      });
      expect(updatedSourceFile!.status).toBe('UPLOADED');
      expect(updatedSourceFile!.sha256).toBe(expectedSha256);

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('XLSX success', () => {
    it('should parse XLSX and transition to PARSED', async () => {
      const XLSX = require('xlsx');
      const company = await prisma.prisma.company.create({
        data: { name: 'Parse XLSX Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['name', 'value'], ['Alice', 100], ['Bob', 200]]), 'Sheet1');
      const xlsxBuffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      const expectedSha256 = require('crypto').createHash('sha256').update(xlsxBuffer).digest('hex');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, xlsxBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'test.xlsx',
          storageKey,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sizeBytes: xlsxBuffer.length,
          sha256: expectedSha256,
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      const response = await parseService.parseImportJob(company.id, importJob.id, user.id);

      expect(response.status).toBe('PARSED');
      expect(response.parseSummary.format).toBe('XLSX');
      expect(response.parseSummary.success).toBe(true);
      expect(response.parseSummary.totalDataRows).toBe(2);
      expect(response.parseSummary.sheetCount).toBe(1);
      expect(response.parseSummary.sheets[0].name).toBe('Sheet1');
      expect(response.parseSummary.sheets[0].headerCount).toBe(2);

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.status).toBe('PARSED');

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('structural failure', () => {
    it('should transition to FAILED on malformed CSV', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Fail Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('name,name\nAlice,30');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'dup.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: expectedSha256,
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      await expect(
        parseService.parseImportJob(company.id, importJob.id, user.id)
      ).rejects.toThrow('duplicate headers');

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.status).toBe('FAILED');
      expect((updatedJob!.parseSummary as any).success).toBe(false);
      expect((updatedJob!.parseSummary as any).error.code).toBe('DUPLICATE_HEADERS');

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('integrity failure', () => {
    it('should not parse when stored hash does not match', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Integrity Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('name,value\nAlice,100');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'tampered.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: 'badhash',
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      await expect(
        parseService.parseImportJob(company.id, importJob.id, user.id)
      ).rejects.toThrow('Source file integrity verification failed');

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.status).toBe('FAILED');
      expect((updatedJob!.parseSummary as any).error.code).toBe('SOURCE_INTEGRITY_FAILED');

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('cross-tenant', () => {
    it('should not parse another company ImportJob', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Tenant A' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Tenant B' },
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

      const csvBuffer = Buffer.from('name,value\nAlice,100');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');
      const storageKey = `imports/${companyA.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: companyA.id,
          originalFilename: 'cross.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: expectedSha256,
          uploadedBy: userA.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: companyA.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: userA.id,
        },
      });

      await expect(
        parseService.parseImportJob(companyB.id, importJob.id, userB.id)
      ).rejects.toThrow('Import job not found');

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.status).toBe('UPLOADED');

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userA.id, companyId: companyA.id } } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } });
      await prisma.prisma.user.delete({ where: { id: userA.id } });
      await prisma.prisma.user.delete({ where: { id: userB.id } });
      await prisma.prisma.company.delete({ where: { id: companyA.id } });
      await prisma.prisma.company.delete({ where: { id: companyB.id } });
    });
  });

  describe('concurrent state protection', () => {
    it('should reject stale parse when job state changed', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Concurrent Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('name,value\nAlice,100');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'concurrent.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: expectedSha256,
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      await prisma.prisma.importJob.updateMany({
        where: { id: importJob.id, companyId: company.id, status: 'UPLOADED' },
        data: { status: 'PARSED' },
      });

      await expect(
        parseService.parseImportJob(company.id, importJob.id, user.id)
      ).rejects.toThrow('Import job is in state "PARSED" and cannot be parsed');

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.status).toBe('PARSED');

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('SourceFile immutability', () => {
    it('should not modify SourceFile during parse', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Immutable Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('name,value\nAlice,100');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'immutable.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: expectedSha256,
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      await parseService.parseImportJob(company.id, importJob.id, user.id);

      const unchanged = await prisma.prisma.sourceFile.findUnique({
        where: { id: sourceFile.id },
      });
      expect(unchanged!.storageKey).toBe(storageKey);
      expect(unchanged!.sha256).toBe(expectedSha256);
      expect(unchanged!.sizeBytes).toBe(csvBuffer.length);
      expect(unchanged!.mimeType).toBe('text/csv');
      expect(unchanged!.originalFilename).toBe('immutable.csv');
      expect(unchanged!.uploadedBy).toBe(user.id);
      expect(unchanged!.status).toBe('UPLOADED');

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('statementType remains null', () => {
    it('should not infer statementType from headers', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Statement Co' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const csvBuffer = Buffer.from('Total Revenue,Net Income\n1000,500');
      const expectedSha256 = require('crypto').createHash('sha256').update(csvBuffer).digest('hex');
      const storageKey = `imports/${company.id}/${uniqueId('source')}`;
      await storageService.write(storageKey, csvBuffer);

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'statement.csv',
          storageKey,
          mimeType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: expectedSha256,
          uploadedBy: user.id,
          status: 'UPLOADED',
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: 'UPLOADED',
          createdBy: user.id,
        },
      });

      const response = await parseService.parseImportJob(company.id, importJob.id, user.id);

      expect(response.status).toBe('PARSED');
      expect(response.parseSummary.sheets[0].headerCount).toBe(2);

      const updatedJob = await prisma.prisma.importJob.findUnique({
        where: { id: importJob.id },
      });
      expect(updatedJob!.statementType).toBeNull();

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });
});
