import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalFileStorageService } from '../storage/local-file-storage.service';
import { CsvParser } from '../parsers/csv-parser';
import { XlsxParser } from '../parsers/xlsx-parser';
import { StagingService } from '../staging.service';
import { MappingService } from '../mapping.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

describe('Ingestion C staging + mapping integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let storageService: LocalFileStorageService;
  let stagingService: StagingService;
  let mappingService: MappingService;
  let csvParser: CsvParser;
  let xlsxParser: XlsxParser;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;
  let tempRoot: string;
  let originalStorageRoot: string | undefined;

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-c-'));
    originalStorageRoot = process.env.INGESTION_STORAGE_ROOT;
    process.env.INGESTION_STORAGE_ROOT = tempRoot;

    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        StagingService,
        MappingService,
        LocalFileStorageService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get<LocalFileStorageService>(LocalFileStorageService);
    stagingService = module.get<StagingService>(StagingService);
    mappingService = module.get<MappingService>(MappingService);
    csvParser = new CsvParser();
    xlsxParser = new XlsxParser();
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
    } catch {}
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

  async function setupCompanyAndJob(csvBuffer: Buffer, fileName = 'test.csv') {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('TestCo') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });

    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const expectedSha256 = crypto.createHash('sha256').update(csvBuffer).digest('hex');
    const storageKey = `imports/${company.id}/${uniqueId('source')}`;
    await storageService.write(storageKey, csvBuffer);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: fileName,
        storageKey,
        mimeType: fileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        status: 'PARSED',
        createdBy: user.id,
      },
    });

    return { company, user, sourceFile, importJob, storageKey, expectedSha256 };
  }

  async function cleanup({ company, user, sourceFile, importJob }: { company: any; user: any; sourceFile: any; importJob: any; storageKey?: string }) {
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  }

  describe('CSV staging', () => {
    it('stages PARSED CSV job and creates ImportRawRows', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000\nCost of Revenue,500');
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(csvBuffer);

      const result = await stagingService.stageImportJob(company.id, importJob.id, user.id);

      expect(result.status).toBe('MAPPED');
      expect(result.stagedRowCount).toBe(2);
      expect(result.sheetCount).toBe(1);

      const rawRows = await prisma.prisma.importRawRow.findMany({
        where: { importJobId: importJob.id },
        orderBy: { rowNumber: 'asc' },
      });
      expect(rawRows.length).toBe(2);
      expect(rawRows[0].values).toEqual(['Revenue', '1000']);
      expect(rawRows[1].values).toEqual(['Cost of Revenue', '500']);
      expect(rawRows[0].companyId).toBe(company.id);
      expect(rawRows[0].sheetIndex).toBe(0);
      expect(rawRows[0].sheetName).toBe('CSV');

      await cleanup({ company, user, sourceFile, importJob });
    });

    it('stages CSV with unknown metrics -> NEEDS_MAPPING', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000\nCustomMetric,500');
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(csvBuffer);

      const result = await stagingService.stageImportJob(company.id, importJob.id, user.id);

      expect(result.status).toBe('NEEDS_MAPPING');
      const job = await prisma.prisma.importJob.findUnique({ where: { id: importJob.id } });
      expect(job!.status).toBe('NEEDS_MAPPING');
      expect(job!.mapping).toBeDefined();

      await cleanup({ company, user, sourceFile, importJob });
    });

    it('blank vs zero preserved in raw staging', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,\nCost of Revenue,0\nEBIT,123.1234567\nGross Profit,-500');
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(csvBuffer);

      await stagingService.stageImportJob(company.id, importJob.id, user.id);

      const rawRows = await prisma.prisma.importRawRow.findMany({
        where: { importJobId: importJob.id },
        orderBy: { rowNumber: 'asc' },
      });

      expect((rawRows[0].values as string[])[1]).toBe('');
      expect((rawRows[1].values as string[])[1]).toBe('0');
      expect((rawRows[2].values as string[])[1]).toBe('123.1234567');
      expect((rawRows[3].values as string[])[1]).toBe('-500');

      await cleanup({ company, user, sourceFile, importJob });
    });
  });

  describe('XLSX staging', () => {
    it('stages multi-sheet XLSX preserving sheet indices', async () => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Metric', 'Value'], ['Revenue', 1000], ['Expenses', 500]]), 'Income');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Metric', 'Value'], ['Total Assets', 2000]]), 'Balance');
      const xlsxBuffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(xlsxBuffer, 'test.xlsx');

      const result = await stagingService.stageImportJob(company.id, importJob.id, user.id);

      expect(result.sheetCount).toBe(2);
      expect(result.stagedRowCount).toBe(3);

      const rawRows = await prisma.prisma.importRawRow.findMany({
        where: { importJobId: importJob.id },
        orderBy: [{ sheetIndex: 'asc' }, { rowNumber: 'asc' }],
      });

      expect(rawRows.length).toBe(3);
      expect(rawRows[0].sheetIndex).toBe(0);
      expect(rawRows[0].sheetName).toBe('Income');
      expect(rawRows[2].sheetIndex).toBe(1);
      expect(rawRows[2].sheetName).toBe('Balance');

      await cleanup({ company, user, sourceFile, importJob });
    });
  });

  describe('cross-tenant isolation', () => {
    it('Company B cannot stage Company A job', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000');
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(csvBuffer);

      const companyB = await prisma.prisma.company.create({ data: { name: uniqueId('CoB') } });
      const userB = await prisma.prisma.user.create({
        data: { id: uniqueId('userB'), email: `${uniqueId('emailb')}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: userB.id, companyId: companyB.id, role: 'OWNER' },
      });

      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

      await expect(
        stagingService.stageImportJob(companyB.id, importJob.id, userB.id),
      ).rejects.toThrow('Import job not found');

      try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } }); } catch {}
      try { await prisma.prisma.user.delete({ where: { id: userB.id } }); } catch {}
      try { await prisma.prisma.company.delete({ where: { id: companyB.id } }); } catch {}
      await cleanup({ company, user, sourceFile, importJob });
    });
  });

  describe('concurrency - staging', () => {
    it('prevents duplicate staging on retry', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000');
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(csvBuffer);

      await stagingService.stageImportJob(company.id, importJob.id, user.id);

      await expect(
        stagingService.stageImportJob(company.id, importJob.id, user.id),
      ).rejects.toThrow();

      const rawRows = await prisma.prisma.importRawRow.findMany({
        where: { importJobId: importJob.id },
      });
      expect(rawRows.length).toBe(rawRows.length);

      await cleanup({ company, user, sourceFile, importJob });
    });
  });

  describe('rollback', () => {
    it('does not leave partial raw rows on transaction failure', async () => {
      const csvBuffer = Buffer.from('Metric,Value\nRevenue,1000');
      const { company, user, sourceFile, importJob } = await setupCompanyAndJob(csvBuffer);

      jest.spyOn(prisma.prisma, '$transaction').mockRejectedValue(new Error('DB error'));

      await expect(
        stagingService.stageImportJob(company.id, importJob.id, user.id),
      ).rejects.toThrow('DB error');

      const rawRows = await prisma.prisma.importRawRow.findMany({ where: { importJobId: importJob.id } });
      expect(rawRows.length).toBe(0);

      const job = await prisma.prisma.importJob.findUnique({ where: { id: importJob.id } });
      expect(job!.status).toBe('PARSED');

      try { jest.restoreAllMocks(); } catch {}
      await cleanup({ company, user, sourceFile, importJob });
    });
  });
});
