import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { NormalizationService } from '../normalization.service';
import { StatementMetadataService } from '../statement-metadata.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { randomUUID } from 'crypto';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

describe('Ingestion E.1 statement metadata integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let normalizationService: NormalizationService;
  let metadataService: StatementMetadataService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        NormalizationService,
        StatementMetadataService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    normalizationService = module.get<NormalizationService>(NormalizationService);
    metadataService = module.get<StatementMetadataService>(StatementMetadataService);
    mockCompanyAccessService = module.get(CompanyAccessService) as jest.Mocked<MockCompanyAccessService>;
  });

  afterAll(async () => {
    if (module) {
      await module.close();
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

  async function setupFullyNormalizedJob() {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('E1Co') } });
    const user = await prisma.prisma.user.create({
      data: {
        id: uniqueId('e1user'),
        email: `${uniqueId('e1email')}@test.com`,
        password: 'hash',
        role: 'ANALYST',
      },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });

    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: 'e1.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv',
        sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'),
        uploadedBy: user.id,
        status: 'UPLOADED',
      },
    });

    const mapping = {
      version: 1,
      orientation: 'ROW_ORIENTED',
      sheets: [{
        sheetIndex: 0,
        sheetName: 'CSV',
        headers: ['Metric', 'Value'],
        columns: [
          { sourceIndex: 0, sourceHeader: 'Metric', role: 'METRIC_LABEL', status: 'RESOLVED' },
          { sourceIndex: 1, sourceHeader: 'Value', role: 'VALUE', status: 'RESOLVED' },
        ],
        rowMappings: [{
          rowNumber: 2,
          sourceLabel: 'Revenue',
          metricCode: 'REVENUE',
          statementType: 'INCOME_STATEMENT',
          status: 'AUTO_MAPPED',
          candidates: [{ code: 'REVENUE', label: 'Revenue', category: 'Revenue', statementType: 'INCOME_STATEMENT' }],
        }],
      }],
    };

    const importJob = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id,
        sourceFileId: sourceFile.id,
        statementType: 'INCOME_STATEMENT',
        status: 'VALIDATED',
        mapping: mapping as any,
        createdBy: user.id,
      },
    });

    await prisma.prisma.importRawRow.create({
      data: {
        id: randomUUID(),
        companyId: company.id,
        importJobId: importJob.id,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 2,
        values: ['Revenue', '-500'] as any,
      },
    });

    // Run normalization to set normalizedAt
    await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    return { company, user, sourceFile, importJob };
  }

  async function cleanup({ company, user, sourceFile, importJob }: { company: any; user: any; sourceFile: any; importJob: any }) {
    try { await prisma.prisma.$executeRawUnsafe('DELETE FROM "import_normalized_rows" WHERE "importJobId" = $1', importJob.id); } catch {}
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  }

  it('transitions to READY with valid metadata on normalized job', async () => {
    const { company, user, sourceFile, importJob } = await setupFullyNormalizedJob();

    const result = await metadataService.finalizeStatementMetadata(
      company.id,
      importJob.id,
      {
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        fiscalYear: 2025,
        periodType: 'ANNUAL',
        currency: 'INR',
        scale: 'ONES',
      },
      user.id,
    );

    expect(result.status).toBe('READY');
    expect(result.periodStart).toBe('2025-01-01');
    expect(result.periodEnd).toBe('2025-12-31');
    expect(result.fiscalYear).toBe(2025);
    expect(result.periodType).toBe('ANNUAL');
    expect(result.currency).toBe('INR');
    expect(result.scale).toBe('ONES');
    expect(result.statementType).toBe('INCOME_STATEMENT');
    expect(result.normalizedRowCount).toBe(1);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('stays VALIDATED when metadata is missing (no metadata supplied)', async () => {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('E1B') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('e1bu'), email: `${uniqueId('e1be')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id, originalFilename: 'e1b.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv', sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user.id, status: 'UPLOADED',
      },
    });

    const importJob = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id, sourceFileId: sourceFile.id,
        statementType: 'INCOME_STATEMENT', status: 'VALIDATED',
        mapping: JSON.parse(JSON.stringify({ version: 1, orientation: 'ROW_ORIENTED', sheets: [] })),
        createdBy: user.id,
      },
    });

    await expect(
      metadataService.finalizeStatementMetadata(
        company.id, importJob.id,
        { periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
        user.id,
      ),
    ).rejects.toThrow('not been normalized');

    const status = await prisma.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "import_jobs" WHERE "id" = ${importJob.id}
    `;
    expect(status[0].status).toBe('VALIDATED');

    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  });

  it('rejects periodStart > periodEnd', async () => {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('E1C') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('e1cu'), email: `${uniqueId('e1ce')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id, originalFilename: 'e1c.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv', sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user.id, status: 'UPLOADED',
      },
    });

    const importJob = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id, sourceFileId: sourceFile.id,
        statementType: 'INCOME_STATEMENT', status: 'VALIDATED',
        mapping: JSON.parse(JSON.stringify({ version: 1, orientation: 'ROW_ORIENTED', sheets: [] })),
        createdBy: user.id,
      },
    });

    await expect(
      metadataService.finalizeStatementMetadata(
        company.id, importJob.id,
        { periodStart: '2025-12-31', periodEnd: '2025-01-01', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
        user.id,
      ),
    ).rejects.toThrow('periodEnd must be on or after periodStart');

    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  });

  it('rejects null statementType (cannot READY)', async () => {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('E1D') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('e1du'), email: `${uniqueId('e1de')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id, originalFilename: 'e1d.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv', sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user.id, status: 'UPLOADED',
      },
    });

    const importJob = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id, sourceFileId: sourceFile.id,
        statementType: null, status: 'VALIDATED',
        mapping: JSON.parse(JSON.stringify({ version: 1, orientation: 'ROW_ORIENTED', sheets: [{ sheetIndex: 0, sheetName: 'CSV', headers: [], columns: [], rowMappings: [{ rowNumber: 2, sourceLabel: 'Revenue', metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', candidates: [] }] }] })),
        createdBy: user.id,
      },
    });

    // Set normalizedAt so we get past normalization check to test statementType
    const now = new Date();
    await prisma.prisma.$executeRaw`
      UPDATE "import_jobs" SET "normalizedAt" = ${now} WHERE "id" = ${importJob.id} AND "companyId" = ${company.id}
    `;

    await expect(
      metadataService.finalizeStatementMetadata(
        company.id, importJob.id,
        { periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
        user.id,
      ),
    ).rejects.toThrow('no statement type');

    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  });

  it('rejects unnormalized VALIDATED job (cannot READY)', async () => {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('E1E') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('e1eu'), email: `${uniqueId('e1ee')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id, originalFilename: 'e1e.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv', sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user.id, status: 'UPLOADED',
      },
    });

    const importJob = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id, sourceFileId: sourceFile.id,
        statementType: 'INCOME_STATEMENT', status: 'VALIDATED',
        mapping: JSON.parse(JSON.stringify({ version: 1, orientation: 'ROW_ORIENTED', sheets: [] })),
        createdBy: user.id,
      },
    });

    await expect(
      metadataService.finalizeStatementMetadata(
        company.id, importJob.id,
        { periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
        user.id,
      ),
    ).rejects.toThrow('not been normalized');

    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  });

  it('prevents cross-tenant metadata update', async () => {
    const { company: companyA, user: userA, sourceFile: sfA, importJob: jobA } = await setupFullyNormalizedJob();

    const companyB = await prisma.prisma.company.create({ data: { name: uniqueId('E1F') } });
    const userB = await prisma.prisma.user.create({
      data: { id: uniqueId('e1fb'), email: `${uniqueId('e1fe')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: userB.id, companyId: companyB.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    await expect(
      metadataService.finalizeStatementMetadata(
        companyB.id, // different company
        jobA.id,     // job from company A
        { periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
        userB.id,
      ),
    ).rejects.toThrow('Import job not found');

    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: userB.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: companyB.id } }); } catch {}
    await cleanup({ company: companyA, user: userA, sourceFile: sfA, importJob: jobA });
  });

  it('rejects metadata update on READY job (immutability)', async () => {
    const { company, user, sourceFile, importJob } = await setupFullyNormalizedJob();

    // First: finalize to READY
    await metadataService.finalizeStatementMetadata(
      company.id, importJob.id,
      { periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
      user.id,
    );

    // Second: attempt to change metadata
    await expect(
      metadataService.finalizeStatementMetadata(
        company.id, importJob.id,
        { periodStart: '2026-01-01', periodEnd: '2026-12-31', fiscalYear: 2026, periodType: 'ANNUAL', currency: 'USD', scale: 'ONES' },
        user.id,
      ),
    ).rejects.toThrow('already READY');

    await cleanup({ company, user, sourceFile, importJob });
  });
});
