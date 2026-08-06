import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { NormalizationService } from '../normalization.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { randomUUID } from 'crypto';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

describe('Ingestion E normalization integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let normalizationService: NormalizationService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        NormalizationService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    normalizationService = module.get<NormalizationService>(NormalizationService);
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

  async function setupValidatedJob(mapping: any, rawRows: Array<{ sheetIndex: number; rowNumber: number; values: string[] }>) {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('NormCo') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('nuser'), email: `${uniqueId('nemail')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });

    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: 'norm.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv',
        sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'),
        uploadedBy: user.id,
        status: 'UPLOADED',
      },
    });

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

    for (const rr of rawRows) {
      await prisma.prisma.importRawRow.create({
        data: {
          id: randomUUID(),
          companyId: company.id,
          importJobId: importJob.id,
          sheetName: 'CSV',
          sheetIndex: rr.sheetIndex,
          rowNumber: rr.rowNumber,
          values: rr.values as any,
        },
      });
    }

    return { company, user, sourceFile, importJob };
  }

  async function cleanupNormalized(companyId: string, importJobId: string) {
    try {
      await prisma.prisma.$executeRawUnsafe(
        'DELETE FROM "import_normalized_rows" WHERE "companyId" = $1 AND "importJobId" = $2',
        companyId,
        importJobId,
      );
    } catch {}
  }

  async function cleanup({ company, user, sourceFile, importJob }: { company: any; user: any; sourceFile: any; importJob: any }) {
    await cleanupNormalized(company.id, importJob.id);
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  }

  function makeMapping(rows: Array<{ rowNumber: number; metricCode: string; statementType: string; status: string; sourceLabel?: string }>) {
    return {
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
        rowMappings: rows.map((r) => ({
          rowNumber: r.rowNumber,
          sourceLabel: r.sourceLabel ?? r.metricCode,
          metricCode: r.metricCode,
          statementType: r.statementType,
          status: r.status,
          candidates: [{ code: r.metricCode, label: r.metricCode, category: 'Test', statementType: r.statementType }],
        })),
      }],
    };
  }

  async function getNormalizedCount(companyId: string, importJobId: string): Promise<number> {
    const rows = await prisma.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int as count FROM "import_normalized_rows"
      WHERE "companyId" = ${companyId} AND "importJobId" = ${importJobId}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async function getNormalizedValues(companyId: string, importJobId: string): Promise<Array<{ value: string; metricDefinitionId: string }>> {
    return await prisma.prisma.$queryRaw<Array<{ value: string; metricDefinitionId: string }>>`
      SELECT "value", "metricDefinitionId" FROM "import_normalized_rows"
      WHERE "companyId" = ${companyId} AND "importJobId" = ${importJobId}
    `;
  }

  it('creates normalized rows for VALIDATED job', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
      { rowNumber: 3, metricCode: 'COST_OF_REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Cost of Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
      { sheetIndex: 0, rowNumber: 3, values: ['Cost of Revenue', '500'] },
    ]);

    const result = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    const count = await getNormalizedCount(company.id, importJob.id);
    expect(count).toBe(2);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('normalizes negative value to positive for Revenue category', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '-500'] },
    ]);

    const result = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    const values = await getNormalizedValues(company.id, importJob.id);
    expect(values.length).toBe(1);
    expect(values[0].value).toBe('500');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('preserves negative sign for CASH_FLOW (signed) categories', async () => {
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
          sourceLabel: 'Depreciation',
          metricCode: 'DEPRECIATION_AMORTIZATION',
          statementType: 'CASH_FLOW',
          status: 'AUTO_MAPPED',
          candidates: [{ code: 'DEPRECIATION_AMORTIZATION', label: 'Depreciation', category: 'Operating', statementType: 'CASH_FLOW' }],
        }],
      }],
    };
    const company2 = await prisma.prisma.company.create({ data: { name: uniqueId('CashCo') } });
    const user2 = await prisma.prisma.user.create({
      data: { id: uniqueId('cuser'), email: `${uniqueId('cemail')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user2.id, companyId: company2.id, role: 'OWNER' },
    });

    const importJob2 = await prisma.prisma.importJob.create({
      data: {
        companyId: company2.id,
        sourceFileId: (await prisma.prisma.sourceFile.create({
          data: {
            companyId: company2.id, originalFilename: 'cash.csv', storageKey: `imports/${company2.id}/${uniqueId('src')}`,
            mimeType: 'text/csv', sizeBytes: 100, sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user2.id, status: 'UPLOADED',
          },
        })).id,
        statementType: 'CASH_FLOW',
        status: 'VALIDATED',
        mapping: mapping as any,
        createdBy: user2.id,
      },
    });

    await prisma.prisma.importRawRow.create({
      data: {
        id: randomUUID(), companyId: company2.id, importJobId: importJob2.id,
        sheetName: 'CSV', sheetIndex: 0, rowNumber: 2, values: ['Depreciation', '-100'] as any,
      },
    });

    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const result = await normalizationService.normalizeImportJob(company2.id, importJob2.id, user2.id);

    expect(result.valid).toBe(true);
    const values = await getNormalizedValues(company2.id, importJob2.id);
    expect(values.length).toBe(1);
    expect(values[0].value).toBe('-100');

    await cleanupNormalized(company2.id, importJob2.id);
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob2.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob2.id } }); } catch {}
    try { await prisma.prisma.sourceFile.deleteMany({ where: { companyId: company2.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user2.id, companyId: company2.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user2.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company2.id } }); } catch {}
  });

  it('creates no normalized row for blank value', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', ''] },
    ]);

    const result = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    const count = await getNormalizedCount(company.id, importJob.id);
    expect(count).toBe(0);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('creates normalized row for explicit zero', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '0'] },
    ]);

    const result = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    const count = await getNormalizedCount(company.id, importJob.id);
    expect(count).toBe(1);
    const values = await getNormalizedValues(company.id, importJob.id);
    expect(values[0].value).toBe('0');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('preserves explicit zero with decimals (0.000000)', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '0.000000'] },
    ]);

    const result = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    const values = await getNormalizedValues(company.id, importJob.id);
    expect(values[0].value).toBe('0.000000');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('detects cross-sheet duplicate metric', async () => {
    const mapping: any = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    mapping.sheets.push({
      sheetIndex: 1,
      sheetName: 'Duplicate',
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
    });
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
      { sheetIndex: 1, rowNumber: 2, values: ['Revenue', '2000'] },
    ]);

    await expect(
      normalizationService.normalizeImportJob(company.id, importJob.id, user.id),
    ).rejects.toThrow('Duplicate metric');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('remains idempotent on retry (no duplicate rows)', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
    ]);

    const result1 = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);
    expect(result1.valid).toBe(true);
    expect(result1.normalizedRowCount).toBe(1);

    const result2 = await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);
    expect(result2.valid).toBe(true);
    expect(result2.normalizedRowCount).toBe(1);

    const count = await getNormalizedCount(company.id, importJob.id);
    expect(count).toBe(1);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects job not in VALIDATED state', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('StCo') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('suser'), email: `${uniqueId('semail')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: 's.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv', sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user.id, status: 'UPLOADED',
      },
    });

    const importJob = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id, sourceFileId: sourceFile.id,
        statementType: 'INCOME_STATEMENT', status: 'MAPPED', mapping: mapping as any, createdBy: user.id,
      },
    });

    await expect(
      normalizationService.normalizeImportJob(company.id, importJob.id, user.id),
    ).rejects.toThrow('cannot be normalized');

    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  });

  it('prevents cross-tenant normalization', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupValidatedJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
    ]);

    const companyB = await prisma.prisma.company.create({ data: { name: uniqueId('NormCoB') } });
    const userB = await prisma.prisma.user.create({
      data: { id: uniqueId('normuserb'), email: `${uniqueId('normemailb')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: userB.id, companyId: companyB.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    await expect(
      normalizationService.normalizeImportJob(companyB.id, importJob.id, userB.id),
    ).rejects.toThrow('Import job not found');

    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: userB.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: companyB.id } }); } catch {}
    await cleanup({ company, user, sourceFile, importJob });
  });
});
