import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '../generated/client';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('ImportRawRow schema DB-backed', () => {
  let prisma: PrismaService;
  let companyAId: string;
  let companyBId: string;
  let sourceFileAId: string;
  let sourceFileBId: string;
  let importJobAId: string;
  let importJobBId: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();

    const companyA = await prisma.prisma.company.create({ data: { name: uniqueId('CompanyA') } });
    companyAId = companyA.id;
    const companyB = await prisma.prisma.company.create({ data: { name: uniqueId('CompanyB') } });
    companyBId = companyB.id;

    const sourceFileA = await prisma.prisma.sourceFile.create({
      data: {
        companyId: companyAId,
        originalFilename: 'a.csv',
        storageKey: 'storage-' + uniqueId('key-a'),
        mimeType: 'text/csv',
        sizeBytes: 100,
        sha256: uniqueId('sha-a').padEnd(64, '0'),
        uploadedBy: uniqueId('uploader'),
        status: $Enums.SourceFileStatus.UPLOADED,
      },
    });
    sourceFileAId = sourceFileA.id;

    const sourceFileB = await prisma.prisma.sourceFile.create({
      data: {
        companyId: companyBId,
        originalFilename: 'b.csv',
        storageKey: 'storage-' + uniqueId('key-b'),
        mimeType: 'text/csv',
        sizeBytes: 100,
        sha256: uniqueId('sha-b').padEnd(64, '0'),
        uploadedBy: uniqueId('uploader'),
        status: $Enums.SourceFileStatus.UPLOADED,
      },
    });
    sourceFileBId = sourceFileB.id;

    const importJobA = await prisma.prisma.importJob.create({
      data: {
        companyId: companyAId,
        sourceFileId: sourceFileAId,
        statementType: null,
        status: $Enums.ImportJobStatus.PARSED,
        createdBy: uniqueId('user'),
      },
    });
    importJobAId = importJobA.id;

    const importJobB = await prisma.prisma.importJob.create({
      data: {
        companyId: companyBId,
        sourceFileId: sourceFileBId,
        statementType: null,
        status: $Enums.ImportJobStatus.PARSED,
        createdBy: uniqueId('user'),
      },
    });
    importJobBId = importJobB.id;
  });

  afterEach(async () => {
    await prisma.prisma.importRawRow.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.prisma.importJob.deleteMany({ where: { id: { in: [importJobAId, importJobBId] } } });
    await prisma.prisma.sourceFile.deleteMany({ where: { id: { in: [sourceFileAId, sourceFileBId] } } });
    await prisma.prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.onModuleDestroy();
  });

  it('ImportRawRow persists with all fields', async () => {
    const row = await prisma.prisma.importRawRow.create({
      data: {
        companyId: companyAId,
        importJobId: importJobAId,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 1,
        values: ['Revenue', '1000'],
      },
    });

    expect(row.id).toBeDefined();
    expect(row.companyId).toBe(companyAId);
    expect(row.importJobId).toBe(importJobAId);
    expect(row.sheetName).toBe('CSV');
    expect(row.sheetIndex).toBe(0);
    expect(row.rowNumber).toBe(1);
    expect(row.values).toEqual(['Revenue', '1000']);
  });

  it('ImportJob 1:N raw rows', async () => {
    await prisma.prisma.importRawRow.createMany({
      data: [
        { id: uniqueId('row'), companyId: companyAId, importJobId: importJobAId, sheetName: 'CSV', sheetIndex: 0, rowNumber: 1, values: ['Revenue', '1000'] },
        { id: uniqueId('row'), companyId: companyAId, importJobId: importJobAId, sheetName: 'CSV', sheetIndex: 0, rowNumber: 2, values: ['Expenses', '500'] },
      ],
    });

    const job = await prisma.prisma.importJob.findUnique({
      where: { id: importJobAId },
      include: { rawRows: true },
    });
    expect(job!.rawRows.length).toBe(2);
  });

  it('same-company relation accepted', async () => {
    const row = await prisma.prisma.importRawRow.create({
      data: {
        companyId: companyAId,
        importJobId: importJobAId,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 1,
        values: ['Revenue', '1000'],
      },
    });
    expect(row.importJobId).toBe(importJobAId);
    expect(row.companyId).toBe(companyAId);
  });

  it('cross-company relation rejected at DB level', async () => {
    await expect(
      prisma.prisma.importRawRow.create({
        data: {
          companyId: companyBId,
          importJobId: importJobAId,
          sheetName: 'CSV',
          sheetIndex: 0,
          rowNumber: 1,
          values: ['Revenue', '1000'],
        },
      }),
    ).rejects.toThrow();
  });

  it('ImportJob deletion cascades raw rows', async () => {
    await prisma.prisma.importRawRow.createMany({
      data: [
        { id: uniqueId('row'), companyId: companyAId, importJobId: importJobAId, sheetName: 'CSV', sheetIndex: 0, rowNumber: 1, values: ['Revenue', '1000'] },
        { id: uniqueId('row'), companyId: companyAId, importJobId: importJobAId, sheetName: 'CSV', sheetIndex: 0, rowNumber: 2, values: ['Expenses', '500'] },
      ],
    });

    await prisma.prisma.importJob.delete({ where: { id: importJobAId } });

    const remaining = await prisma.prisma.importRawRow.findMany({ where: { importJobId: importJobAId } });
    expect(remaining.length).toBe(0);

    importJobAId = '';
  });

  it('Company deletion cascades to ImportJob deletes raw rows', async () => {
    await prisma.prisma.importRawRow.create({
      data: {
        companyId: companyAId,
        importJobId: importJobAId,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 1,
        values: ['Revenue', '1000'],
      },
    });

    await prisma.prisma.company.delete({ where: { id: companyAId } });

    const remaining = await prisma.prisma.importRawRow.findMany({ where: { companyId: companyAId } });
    expect(remaining.length).toBe(0);
    companyAId = '';
  });

  it('unique source row identity enforced', async () => {
    const baseRow = {
      companyId: companyAId,
      importJobId: importJobAId,
      sheetName: 'CSV',
      sheetIndex: 0,
      rowNumber: 1,
      values: ['Revenue', '1000'],
    };

    await prisma.prisma.importRawRow.create({ data: baseRow });

    await expect(
      prisma.prisma.importRawRow.create({ data: { ...baseRow, id: uniqueId('dup') } }),
    ).rejects.toThrow();
  });

  it('raw JSON values preserve blank/zero/high-precision text', async () => {
    await prisma.prisma.importRawRow.create({
      data: {
        companyId: companyAId,
        importJobId: importJobAId,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 1,
        values: ['Revenue', ''],
      },
    });

    await prisma.prisma.importRawRow.create({
      data: {
        companyId: companyAId,
        importJobId: importJobAId,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 2,
        values: ['Expenses', '0'],
      },
    });

    await prisma.prisma.importRawRow.create({
      data: {
        companyId: companyAId,
        importJobId: importJobAId,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 3,
        values: ['Tax', '123.1234567'],
      },
    });

    const rows = await prisma.prisma.importRawRow.findMany({
      where: { importJobId: importJobAId },
      orderBy: { rowNumber: 'asc' },
    });

    expect(rows.length).toBe(3);
    expect((rows[0].values as string[])[1]).toBe('');
    expect((rows[1].values as string[])[1]).toBe('0');
    expect((rows[2].values as string[])[1]).toBe('123.1234567');
  });

  it('raw row survives user deletion through job provenance', async () => {
    const user = await prisma.prisma.user.create({
      data: { id: uniqueId('raw-user'), email: `${uniqueId('raw-email')}@test.com`, password: 'hash', role: 'USER' },
    });

    const company = await prisma.prisma.company.create({
      data: { name: uniqueId('RawUserCo'), ownerId: user.id },
    });

    const file = await prisma.prisma.sourceFile.create({
      data: {
        companyId: company.id,
        originalFilename: 'raw.csv',
        storageKey: 'storage-' + uniqueId('raw-key'),
        mimeType: 'text/csv',
        sizeBytes: 100,
        sha256: uniqueId('raw-sha').padEnd(64, '0'),
        uploadedBy: user.id,
        status: $Enums.SourceFileStatus.UPLOADED,
      },
    });

    const job = await prisma.prisma.importJob.create({
      data: {
        companyId: company.id,
        sourceFileId: file.id,
        statementType: null,
        status: $Enums.ImportJobStatus.PARSED,
        createdBy: user.id,
      },
    });

    const rawRow = await prisma.prisma.importRawRow.create({
      data: {
        companyId: company.id,
        importJobId: job.id,
        sheetName: 'CSV',
        sheetIndex: 0,
        rowNumber: 1,
        values: ['Revenue', '1000'],
      },
    });

    await prisma.prisma.user.delete({ where: { id: user.id } });

    const preserved = await prisma.prisma.importRawRow.findUnique({ where: { id: rawRow.id } });
    expect(preserved).toBeDefined();
    expect(preserved!.importJobId).toBe(job.id);

    await prisma.prisma.importJob.delete({ where: { id: job.id } });
    await prisma.prisma.sourceFile.delete({ where: { id: file.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('row ordering fields persist (sheetIndex + rowNumber)', async () => {
    const rows = [
      { companyId: companyAId, importJobId: importJobAId, sheetName: 'Sheet1', sheetIndex: 0, rowNumber: 2, values: ['B', '2'] },
      { companyId: companyAId, importJobId: importJobAId, sheetName: 'Sheet2', sheetIndex: 1, rowNumber: 1, values: ['A', '1'] },
      { companyId: companyAId, importJobId: importJobAId, sheetName: 'Sheet1', sheetIndex: 0, rowNumber: 1, values: ['A', '1'] },
      { companyId: companyAId, importJobId: importJobAId, sheetName: 'Sheet2', sheetIndex: 1, rowNumber: 2, values: ['B', '2'] },
    ];

    await prisma.prisma.importRawRow.createMany({
      data: rows.map((r, i) => ({ ...r, id: uniqueId(`row-${i}`) })),
    });

    const ordered = await prisma.prisma.importRawRow.findMany({
      where: { importJobId: importJobAId },
      orderBy: [{ sheetIndex: 'asc' }, { rowNumber: 'asc' }],
    });

    expect(ordered.length).toBe(4);
    expect(ordered[0].sheetIndex).toBe(0);
    expect(ordered[0].rowNumber).toBe(1);
    expect(ordered[1].sheetIndex).toBe(0);
    expect(ordered[1].rowNumber).toBe(2);
    expect(ordered[2].sheetIndex).toBe(1);
    expect(ordered[2].rowNumber).toBe(1);
    expect(ordered[3].sheetIndex).toBe(1);
    expect(ordered[3].rowNumber).toBe(2);
  });
});
