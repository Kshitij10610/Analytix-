import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { NormalizationService } from '../normalization.service';
import { StatementMetadataService } from '../statement-metadata.service';
import { TrustedCommitService } from '../trusted-commit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { randomUUID } from 'crypto';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
  requireCompanyRead = jest.fn();
}

interface SetupResult {
  company: any;
  user: any;
  sourceFile: any;
  importJob: any;
}

describe('Ingestion F trusted commit integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let normalizationService: NormalizationService;
  let metadataService: StatementMetadataService;
  let commitService: TrustedCommitService;
  let mockCompanyAccessService: jest.Mocked<MockCompanyAccessService>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        NormalizationService,
        StatementMetadataService,
        TrustedCommitService,
        AuditService,
        { provide: CompanyAccessService, useClass: MockCompanyAccessService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    normalizationService = module.get<NormalizationService>(NormalizationService);
    metadataService = module.get<StatementMetadataService>(StatementMetadataService);
    commitService = module.get<TrustedCommitService>(TrustedCommitService);
    mockCompanyAccessService = module.get(CompanyAccessService) as jest.Mocked<MockCompanyAccessService>;
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await prisma.onModuleInit();
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  async function setupCommittableJob(): Promise<SetupResult> {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('FCo') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('fuser'), email: `${uniqueId('femail')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id, originalFilename: 'f.csv',
        storageKey: `imports/${company.id}/${uniqueId('src')}`,
        mimeType: 'text/csv', sizeBytes: 100,
        sha256: uniqueId('sha').padEnd(64, '0'), uploadedBy: user.id, status: 'UPLOADED',
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
        rowMappings: [
          { rowNumber: 2, sourceLabel: 'Revenue', metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', candidates: [{ code: 'REVENUE', label: 'Revenue', category: 'Revenue', statementType: 'INCOME_STATEMENT' }] },
          { rowNumber: 3, sourceLabel: 'COGS', metricCode: 'COST_OF_REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', candidates: [{ code: 'COST_OF_REVENUE', label: 'Cost of Revenue', category: 'Revenue', statementType: 'INCOME_STATEMENT' }] },
        ],
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
      data: { id: randomUUID(), companyId: company.id, importJobId: importJob.id, sheetName: 'CSV', sheetIndex: 0, rowNumber: 2, values: ['Revenue', '-500'] as any },
    });
    await prisma.prisma.importRawRow.create({
      data: { id: randomUUID(), companyId: company.id, importJobId: importJob.id, sheetName: 'CSV', sheetIndex: 0, rowNumber: 3, values: ['COGS', '300'] as any },
    });

    // Run Stage E normalization
    await normalizationService.normalizeImportJob(company.id, importJob.id, user.id);

    // Run Stage E.1 metadata finalization → READY
    await metadataService.finalizeStatementMetadata(
      company.id, importJob.id,
      { periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalYear: 2025, periodType: 'ANNUAL', currency: 'INR', scale: 'ONES' },
      user.id,
    );

    return { company, user, sourceFile, importJob };
  }

  async function cleanup({ company, user, sourceFile, importJob }: SetupResult) {
    const statements = await prisma.prisma.financialStatement.findMany({
      where: { sourceReference: importJob.id },
      select: { id: true },
    });
    for (const stmt of statements) {
      try { await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: stmt.id } }); } catch {}
      try { await prisma.prisma.financialStatement.delete({ where: { id: stmt.id } }); } catch {}
    }
    try { await prisma.prisma.$executeRawUnsafe('DELETE FROM "import_normalized_rows" WHERE "importJobId" = $1', importJob.id); } catch {}
    try { await prisma.prisma.importRawRow.deleteMany({ where: { importJobId: importJob.id } }); } catch {}
    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  }

  it('commits READY job to trusted FinancialStatement + line items', async () => {
    const setup = await setupCommittableJob();

    const result = await commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id);

    expect(result.status).toBe('COMPLETED');
    expect(result.statementId).toBeTruthy();
    expect(result.lineItemCount).toBe(2);
    expect(result.statementType).toBe('INCOME_STATEMENT');
    expect(result.currency).toBe('INR');
    expect(result.scale).toBe('ONES');
    expect(result.fiscalYear).toBe(2025);
    expect(result.sourceType).toBe('CSV_IMPORT');
    expect(result.sourceReference).toBe(setup.importJob.id);

    // Verify provenance: FinancialStatement sourceReference points to ImportJob
    const stmt = await prisma.prisma.financialStatement.findUnique({
      where: { id: result.statementId },
      include: { financial_line_items: true },
    });
    expect(stmt).not.toBeNull();
    expect(stmt!.companyId).toBe(setup.company.id);
    expect(stmt!.type).toBe('INCOME_STATEMENT');
    expect(stmt!.periodStart).toEqual(new Date('2025-01-01'));
    expect(stmt!.periodEnd).toEqual(new Date('2025-12-31'));
    expect(stmt!.fiscalYear).toBe(2025);
    expect(stmt!.periodType).toBe('ANNUAL');
    expect(stmt!.currency).toBe('INR');
    expect(stmt!.scale).toBe('ONES');
    expect(stmt!.sourceType).toBe('CSV_IMPORT');
    expect(stmt!.sourceReference).toBe(setup.importJob.id);
    expect(stmt!.importedBy).toBe(setup.user.id);
    expect(stmt!.financial_line_items.length).toBe(2);

    // Verify sign normalization was preserved (Revenue -500 → 500)
    const revenueLi = stmt!.financial_line_items.find(
      (li) => li.metricDefinitionId === stmt!.financial_line_items[0].metricDefinitionId || true,
    );
    // Check that Revenue value is positive (sign was normalized in Stage E)
    const rev = await prisma.prisma.financialLineItem.findFirst({
      where: { financialStatementId: stmt!.id },
      include: { metric_definitions: true },
    });
    const allItems = await prisma.prisma.financialLineItem.findMany({
      where: { financialStatementId: stmt!.id },
      include: { metric_definitions: true },
    });
    const revItem = allItems.find((li) => li.metric_definitions.code === 'REVENUE');
    expect(revItem).toBeDefined();
    expect(revItem!.value.toFixed(6)).toBe('500.000000');

    // Verify ImportJob status transitioned to COMPLETED
    const updatedJob = await prisma.prisma.importJob.findUnique({
      where: { id: setup.importJob.id },
      select: { status: true, committedStatementId: true },
    });
    expect(updatedJob!.status).toBe('COMPLETED');
    expect(updatedJob!.committedStatementId).toBe(stmt!.id);

    await cleanup(setup);
  });

  it('rejects non-READY (VALIDATED) job for commit', async () => {
    const company = await prisma.prisma.company.create({ data: { name: uniqueId('FRej') } });
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('freject'), email: `${uniqueId('freje')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    const sourceFile = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id, originalFilename: 'f.csv',
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
      commitService.commitImportJob(company.id, importJob.id, user.id),
    ).rejects.toThrow('must be READY');

    try { await prisma.prisma.importJob.delete({ where: { id: importJob.id } }); } catch {}
    try { await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }); } catch {}
    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: user.id, companyId: company.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: user.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: company.id } }); } catch {}
  });

  it('is idempotent: repeated commit does not create duplicates', async () => {
    const setup = await setupCommittableJob();

    const result1 = await commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id);
    const result2 = await commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id);

    expect(result1.statementId).toBe(result2.statementId);
    expect(result1.status).toBe('COMPLETED');
    expect(result2.status).toBe('COMPLETED');

    const stmts = await prisma.prisma.financialStatement.findMany({
      where: { sourceReference: setup.importJob.id },
    });
    expect(stmts.length).toBe(1);

    const lineItems = await prisma.prisma.financialLineItem.findMany({
      where: { financialStatementId: result1.statementId },
    });
    expect(lineItems.length).toBe(2);

    await cleanup(setup);
  });

  it('prevents cross-tenant commit', async () => {
    const setup = await setupCommittableJob();

    // Company B tries to commit Company A's job
    const companyB = await prisma.prisma.company.create({ data: { name: uniqueId('FTen') } });
    const userB = await prisma.prisma.user.create({
      data: { id: uniqueId('ftb'), email: `${uniqueId('ftbe')}@test.com`, password: 'hash', role: 'ANALYST' },
    });
    await prisma.prisma.companyMember.create({
      data: { userId: userB.id, companyId: companyB.id, role: 'OWNER' },
    });
    mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);

    await expect(
      commitService.commitImportJob(companyB.id, setup.importJob.id, userB.id),
    ).rejects.toThrow('Import job not found');

    try { await prisma.prisma.companyMember.delete({ where: { userId_companyId: { userId: userB.id, companyId: companyB.id } } }); } catch {}
    try { await prisma.prisma.user.delete({ where: { id: userB.id } }); } catch {}
    try { await prisma.prisma.company.delete({ where: { id: companyB.id } }); } catch {}
    await cleanup(setup);
  });

  it('provenance chain: source file -> import job -> statement -> line items', async () => {
    const setup = await setupCommittableJob();

    const result = await commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id);

    // Verify source file → import job linkage
    const job = await prisma.prisma.importJob.findUnique({
      where: { id: setup.importJob.id },
      include: { sourceFile: true },
    });
    expect(job!.sourceFileId).toBe(setup.sourceFile.id);
    expect(job!.sourceFile.originalFilename).toBe('f.csv');

    // Verify import job → financial statement linkage
    expect(job!.committedStatementId).toBe(result.statementId);

    // Verify financial statement → source file via sourceReference
    const stmt = await prisma.prisma.financialStatement.findUnique({
      where: { id: result.statementId },
    });
    expect(stmt!.sourceReference).toBe(setup.importJob.id);

    // Verify all line items trace back to the statement
    const lineItems = await prisma.prisma.financialLineItem.findMany({
      where: { financialStatementId: stmt!.id },
      include: { metric_definitions: true },
    });
    expect(lineItems.length).toBe(2);
    const codes = lineItems.map((li) => li.metric_definitions.code).sort();
    expect(codes).toEqual(['COST_OF_REVENUE', 'REVENUE']);

    await cleanup(setup);
  });

  it('transaction rolls back on failure (no orphan records)', async () => {
    const setup = await setupCommittableJob();

    // Sabotage: set fiscalYear to null to cause FinancialStatement creation to fail
    await prisma.prisma.$executeRaw`
      UPDATE "import_jobs" SET "fiscalYear" = NULL WHERE "id" = ${setup.importJob.id} AND "companyId" = ${setup.company.id}
    `;

    await expect(
      commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id),
    ).rejects.toThrow();

    // Verify no FinancialStatement was created
    const stmts = await prisma.prisma.financialStatement.findMany({
      where: { sourceReference: setup.importJob.id },
    });
    expect(stmts.length).toBe(0);

    // Verify ImportJob status is still READY (not COMPLETED)
    const job = await prisma.prisma.importJob.findUnique({
      where: { id: setup.importJob.id },
      select: { status: true, committedStatementId: true },
    });
    expect(job!.status).toBe('READY');
    expect(job!.committedStatementId).toBeNull();

    await cleanup(setup);
  });

  it('fails closed on missing metadata (defensive check)', async () => {
    const setup = await setupCommittableJob();

    // Sabotage: set currency to null after READY
    await prisma.prisma.$executeRaw`
      UPDATE "import_jobs" SET "currency" = NULL WHERE "id" = ${setup.importJob.id} AND "companyId" = ${setup.company.id}
    `;

    await expect(
      commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id),
    ).rejects.toThrow('missing trusted statement metadata');

    const stmts = await prisma.prisma.financialStatement.findMany({
      where: { sourceReference: setup.importJob.id },
    });
    expect(stmts.length).toBe(0);

    await cleanup(setup);
  });

  it('concurrent commit prevents duplicate (race condition)', async () => {
    const setup = await setupCommittableJob();

    const results = await Promise.allSettled([
      commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id),
      commitService.commitImportJob(setup.company.id, setup.importJob.id, setup.user.id),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed, one should fail (second sees COMPLETED/READY status or committedStatementId)
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const stmts = await prisma.prisma.financialStatement.findMany({
      where: { sourceReference: setup.importJob.id },
    });
    expect(stmts.length).toBe(1);

    await cleanup(setup);
  });
});
