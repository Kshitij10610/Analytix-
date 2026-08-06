import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalFileStorageService } from '../storage/local-file-storage.service';
import { StagingService } from '../staging.service';
import { MappingService } from '../mapping.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

describe('Ingestion C mapping confirmation integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let storageService: LocalFileStorageService;
  let stagingService: StagingService;
  let mappingService: MappingService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;
  let tempRoot: string;
  let originalStorageRoot: string | undefined;

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-c-mapping-'));
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

  async function setupJobWithUnknowns(csvContent: string) {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('MapCo') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('muser'), email: `${uniqueId('memail')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });

    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const csvBuffer = Buffer.from(csvContent);
    const expectedSha256 = crypto.createHash('sha256').update(csvBuffer).digest('hex');
    const storageKey = `imports/${company.id}/${uniqueId('source')}`;
    await storageService.write(storageKey, csvBuffer);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: 'mapping.csv',
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
        status: 'PARSED',
        createdBy: user.id,
      },
    });

    await stagingService.stageImportJob(company.id, importJob.id, user.id);

    const fresh = await prisma.prisma.importJob.findUnique({
      where: { id: importJob.id },
      select: { id: true, status: true, mapping: true, companyId: true },
    });

    return { company, user, sourceFile, importJob, fresh };
  }

  async function cleanup({ company, user, sourceFile, importJob }: { company: any; user: any; sourceFile: any; importJob: any }) {
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  }

  it('auto-maps exact metric label match', async () => {
    const csv = 'Metric,Value\nRevenue,1000\nCost of Revenue,500';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('MAPPED');
    const mapping = fresh!.mapping as any;
    const sheet = mapping.sheets[0];
    expect(sheet.rowMappings[0].metricCode).toBe('REVENUE');
    expect(sheet.rowMappings[0].status).toBe('AUTO_MAPPED');
    expect(sheet.rowMappings[1].metricCode).toBe('COST_OF_REVENUE');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('auto-maps code match case-insensitive', async () => {
    const csv = 'Metric,Value\nrevenue,1000';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('MAPPED');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('auto-maps label match with case differences', async () => {
    const csv = 'Metric,Value\nTOTAL ASSETS,5000';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    const mapping = fresh!.mapping as any;
    const sheet = mapping.sheets[0];
    expect(sheet.rowMappings[0].status).toBe('AUTO_MAPPED');
    expect(sheet.rowMappings[0].metricCode).toBe('TOTAL_ASSETS');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('marks ambiguous (same code, multiple statement types) for user confirmation', async () => {
    const csv = 'Metric,Value\nNet Income,500';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('NEEDS_MAPPING');
    const mapping = fresh!.mapping as any;
    const sheet = mapping.sheets[0];
    expect(sheet.rowMappings[0].status).toBe('AMBIGUOUS');
    expect(sheet.rowMappings[0].candidates.length).toBeGreaterThanOrEqual(1);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('marks unknown metric for confirmation', async () => {
    const csv = 'Metric,Value\nRevenue,1000\nCustomMetric,500';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('NEEDS_MAPPING');
    const mapping = fresh!.mapping as any;
    const sheet = mapping.sheets[0];
    expect(sheet.rowMappings[0].metricCode).toBe('REVENUE');
    expect(sheet.rowMappings[0].status).toBe('AUTO_MAPPED');
    expect(sheet.rowMappings[1].metricCode).toBeNull();
    expect(sheet.rowMappings[1].status).toBe('UNKNOWN');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('user confirms unknown metric -> NEEDS_MAPPING to MAPPED', async () => {
    const csv = 'Metric,Value\nRevenue,1000\nCustomMetric,500';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('NEEDS_MAPPING');

    const result = await mappingService.confirmMapping(company.id, importJob.id, user.id, {
      statementType: 'INCOME_STATEMENT',
      sheets: [{
        sheetIndex: 0,
        rowMappings: [{ rowNumber: 3, metricCode: 'NET_INCOME' }],
      }],
    });

    expect(result.status).toBe('MAPPED');

    const updated = await prisma.prisma.importJob.findUnique({
      where: { id: importJob.id },
      select: { status: true, mapping: true, statementType: true },
    });
    expect(updated!.status).toBe('MAPPED');
    expect(updated!.statementType).toBe('INCOME_STATEMENT');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('user confirms ambiguous metric with statement type', async () => {
    const csv = 'Metric,Value\nNet Income,500';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('NEEDS_MAPPING');

    const result = await mappingService.confirmMapping(company.id, importJob.id, user.id, {
      statementType: 'INCOME_STATEMENT',
      sheets: [{
        sheetIndex: 0,
        rowMappings: [{ rowNumber: 2, metricCode: 'NET_INCOME' }],
      }],
    });

    expect(result.status).toBe('MAPPED');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejected: unknown metric code in confirmation', async () => {
    const csv = 'Metric,Value\nRevenue,1000\nCustomMetric,500';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    await expect(
      mappingService.confirmMapping(company.id, importJob.id, user.id, {
        sheets: [{
          sheetIndex: 0,
          rowMappings: [{ rowNumber: 3, metricCode: 'FAKE_CODE' }],
        }],
      }),
    ).rejects.toThrow('Unknown metric code');

    await cleanup({ company, user, sourceFile, importJob });
  });

    it('rejected: incomplete mapping stays NEEDS_MAPPING', async () => {
      const csv = 'Metric,Value\nRevenue,1000\nCustomMetric1,500\nCustomMetric2,200';
      const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('NEEDS_MAPPING');

    const result = await mappingService.confirmMapping(company.id, importJob.id, user.id, {
        sheets: [{
          sheetIndex: 0,
          rowMappings: [{ rowNumber: 3, metricCode: 'COST_OF_REVENUE' }],
        }],
      });

      expect(result.status).toBe('NEEDS_MAPPING');

      await cleanup({ company, user, sourceFile, importJob });
    });

  it('rejected: confirmation in wrong job state', async () => {
    const csv = 'Metric,Value\nRevenue,1000';
    const { company, user, sourceFile, importJob, fresh } = await setupJobWithUnknowns(csv);

    expect(fresh!.status).toBe('MAPPED');

    await expect(
      mappingService.confirmMapping(company.id, importJob.id, user.id, {
        sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'REVENUE' }] }],
      }),
    ).rejects.toThrow('mapping cannot be updated');

    await cleanup({ company, user, sourceFile, importJob });
  });
});
