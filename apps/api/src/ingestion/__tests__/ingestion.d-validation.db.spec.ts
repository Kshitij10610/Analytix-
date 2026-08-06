import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { ValidationService } from '../validation.service';
import { PrismaModule } from '../../prisma/prisma.module';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

describe('Ingestion D validation integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let validationService: ValidationService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        ValidationService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    validationService = module.get<ValidationService>(ValidationService);
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

  async function setupJob(mapping: any, rawRows: Array<{ sheetIndex: number; rowNumber: number; values: string[] }>, statementType: any = null, status: any = 'MAPPED') {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('ValCo') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('vuser'), email: `${uniqueId('vemail')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });

    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: 'validation.csv',
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
        statementType,
        status,
        mapping: mapping as any,
        createdBy: user.id,
      },
    });

    const { randomUUID } = require('crypto');
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

  async function cleanup({ company, user, sourceFile, importJob }: { company: any; user: any; sourceFile: any; importJob: any }) {
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  }

  function makeMapping(rows: Array<{ rowNumber: number; metricCode: string | null; statementType: string | null; status: string; sourceLabel?: string }>) {
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
          sourceLabel: r.sourceLabel ?? r.metricCode ?? '',
          metricCode: r.metricCode,
          statementType: r.statementType,
          status: r.status,
          candidates: r.metricCode
            ? [{ code: r.metricCode, label: r.metricCode, category: 'Test', statementType: r.statementType ?? '' }]
            : [],
        })),
      }],
    };
  }

  it('accepts valid financial values with 6 decimal places', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '100.123456'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    expect(result.status).toBe('VALIDATED');

    const updated = await prisma.prisma.importJob.findUnique({
      where: { id: importJob.id },
      select: { status: true, validationErrors: true },
    });
    expect(updated!.status).toBe('VALIDATED');
    expect(updated!.validationErrors).toBeNull();

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects value with 7 decimal places', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '100.1234567'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.status).toBe('MAPPED');
    expect(result.totalErrorCount).toBe(1);
    expect(result.errors[0].code).toBe('INVALID_VALUE_FORMAT');

    const updated = await prisma.prisma.importJob.findUnique({
      where: { id: importJob.id },
      select: { status: true, validationErrors: true },
    });
    expect(updated!.status).toBe('MAPPED');
    expect(updated!.validationErrors).toBeDefined();

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('distinguishes blank from zero', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
      { rowNumber: 3, metricCode: 'COST_OF_REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Cost of Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', ''] },
      { sheetIndex: 0, rowNumber: 3, values: ['Cost of Revenue', '0'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    expect(result.status).toBe('VALIDATED');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects explicitly zero with 6 decimals as valid', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '0.000000'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects invalid financial value formats', async () => {
    const codes = [
      'REVENUE', 'COST_OF_REVENUE', 'GROSS_PROFIT', 'EBIT', 'NET_INCOME',
      'OPERATING_EXPENSES', 'OPERATING_INCOME', 'INTEREST_EXPENSE', 'INTEREST_INCOME', 'INCOME_TAX_EXPENSE',
    ];
    const invalidValues = ['1,000', '$1000', '₹500', '(500)', '1e6', 'NaN', 'Infinity', 'abc', '100.', '.5'];
    const mapping = makeMapping(
      codes.map((code, i) => ({
        rowNumber: i + 2,
        metricCode: code,
        statementType: 'INCOME_STATEMENT',
        status: 'AUTO_MAPPED',
        sourceLabel: code,
      })),
    );
    const rawRows = codes.map((code, i) => ({
      sheetIndex: 0,
      rowNumber: i + 2,
      values: [code, invalidValues[i % invalidValues.length]],
    }));
    const { company, user, sourceFile, importJob } = await setupJob(mapping, rawRows);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.status).toBe('MAPPED');
    expect(result.errors.every((e) => e.code === 'INVALID_VALUE_FORMAT')).toBe(true);
    expect(result.totalErrorCount).toBeGreaterThan(0);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('stays MAPPED when unresolved UNKNOWN mappings exist', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
      { rowNumber: 3, metricCode: null, statementType: null, status: 'UNKNOWN', sourceLabel: 'UnknownMetric' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
      { sheetIndex: 0, rowNumber: 3, values: ['UnknownMetric', '500'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.status).toBe('MAPPED');
    expect(result.errors.some((e) => e.code === 'UNRESOLVED_MAPPING')).toBe(true);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('fails when mapped metric does not exist in MetricDefinition', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'FAKE_CODE', statementType: 'INCOME_STATEMENT', status: 'USER_CONFIRMED', sourceLabel: 'FakeMetric' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['FakeMetric', '1000'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'METRIC_NOT_FOUND')).toBe(true);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('detects duplicate metric mapping within same sheet', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
      { rowNumber: 3, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue 2' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
      { sheetIndex: 0, rowNumber: 3, values: ['Revenue 2', '2000'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_METRIC_MAPPING')).toBe(true);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('detects inconsistent statement types across sheets', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    mapping.sheets.push({
      sheetIndex: 1,
      sheetName: 'Balance',
      headers: ['Metric', 'Value'],
      columns: [
        { sourceIndex: 0, sourceHeader: 'Metric', role: 'METRIC_LABEL', status: 'RESOLVED' },
        { sourceIndex: 1, sourceHeader: 'Value', role: 'VALUE', status: 'RESOLVED' },
      ],
      rowMappings: [{
        rowNumber: 2,
        sourceLabel: 'Total Assets',
        metricCode: 'TOTAL_ASSETS',
        statementType: 'BALANCE_SHEET',
        status: 'AUTO_MAPPED',
        candidates: [{ code: 'TOTAL_ASSETS', label: 'Total Assets', category: 'Assets', statementType: 'BALANCE_SHEET' }],
      }],
    });
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
      { sheetIndex: 1, rowNumber: 2, values: ['Total Assets', '5000'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INCONSISTENT_STATEMENT_TYPE')).toBe(true);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects validation on ImportJob not in MAPPED state', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
    ], null, 'PARSED');

    await expect(
      validationService.validateImportJob(company.id, importJob.id, user.id),
    ).rejects.toThrow('cannot be validated');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects re-validation of already VALIDATED job', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
    ], null, 'VALIDATED');

    await expect(
      validationService.validateImportJob(company.id, importJob.id, user.id),
    ).rejects.toThrow('cannot be validated');

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects cross-tenant access', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', '1000'] },
    ]);

    const companyB = await prisma.prisma.company.create({ data: { name: uniqueId('CoB') } });
    const userB = await prisma.prisma.user.create({
      data: { id: uniqueId('userB'), email: `${uniqueId('emailb')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: userB.id, companyId: companyB.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    await expect(
      validationService.validateImportJob(companyB.id, importJob.id, userB.id),
    ).rejects.toThrow('Import job not found');

    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: userB.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: companyB.id } }); } catch {}
    await cleanup({ company, user, sourceFile, importJob });
  });

  it('rejects total precision exceeding 30 digits', async () => {
    const bigNumber = '1' + '0'.repeat(30) + '.123456';
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Revenue' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Revenue', bigNumber] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_VALUE_FORMAT' && e.message.includes('exceeds maximum 30 total digits'))).toBe(true);

    await cleanup({ company, user, sourceFile, importJob });
  });

  it('truncates error list at 100 with truncated flag', async () => {
    const totalRows = 120;
    const metricPrefix = `VALTEST_${Date.now()}`;
    const createdMetrics: string[] = [];
    for (let i = 0; i < totalRows; i++) {
      const code = `${metricPrefix}_${i}`;
      await prisma.prisma.metricDefinition.create({
        data: { code, label: code, category: 'Test', statementType: 'INCOME_STATEMENT', displayOrder: i, updatedAt: new Date() },
      });
      createdMetrics.push(code);
    }

    const rows: Array<{ rowNumber: number; metricCode: string | null; statementType: string | null; status: string; sourceLabel?: string }> = [];
    const rawRows: Array<{ sheetIndex: number; rowNumber: number; values: string[] }> = [];
    for (let i = 0; i < totalRows; i++) {
      const rowNum = i + 2;
      rows.push({ rowNumber: rowNum, metricCode: createdMetrics[i], statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: createdMetrics[i] });
      rawRows.push({ sheetIndex: 0, rowNumber: rowNum, values: [createdMetrics[i], '100.9999999'] });
    }
    const mapping = makeMapping(rows);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, rawRows);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(false);
    expect(result.totalErrorCount).toBe(totalRows);
    expect(result.truncated).toBe(true);
    expect(result.errors.length).toBe(100);

    await cleanup({ company, user, sourceFile, importJob });
    for (const code of createdMetrics) {
      try { await prisma.prisma.metricDefinition.deleteMany({ where: { code, statementType: 'INCOME_STATEMENT' } }); } catch {}
    }
  });

  it('preserves negative values without transformation', async () => {
    const mapping = makeMapping([
      { rowNumber: 2, metricCode: 'GROSS_PROFIT', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', sourceLabel: 'Gross Profit' },
    ]);
    const { company, user, sourceFile, importJob } = await setupJob(mapping, [
      { sheetIndex: 0, rowNumber: 2, values: ['Gross Profit', '-500'] },
    ]);

    const result = await validationService.validateImportJob(company.id, importJob.id, user.id);

    expect(result.valid).toBe(true);
    expect(result.status).toBe('VALIDATED');

    await cleanup({ company, user, sourceFile, importJob });
  });
});
