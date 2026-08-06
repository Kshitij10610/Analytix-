import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '../generated/client';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Ingestion schema foundation DB-backed', () => {
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('SourceFile', () => {
    it('persists with all required fields', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'SourceFile Test Co' },
      });

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'test.csv',
          storageKey: 'storage-' + uniqueId('key'),
          mimeType: 'text/csv',
          sizeBytes: 1024,
          sha256: 'abc123'.padEnd(64, '0'),
          uploadedBy: 'user-' + uniqueId('uploader'),
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      expect(sourceFile.id).toBeDefined();
      expect(sourceFile.companyId).toBe(company.id);
      expect(sourceFile.originalFilename).toBe('test.csv');
      expect(sourceFile.status).toBe($Enums.SourceFileStatus.UPLOADED);

      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('allows same SHA-256 across different companies', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Company A' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Company B' },
      });

      const sharedSha256 = 'sharedsha256'.padEnd(64, '0');

      const fileA = await prisma.prisma.sourceFile.create({
        data: {
          companyId: companyA.id,
          originalFilename: 'a.csv',
          storageKey: 'storage-' + uniqueId('key-a'),
          mimeType: 'text/csv',
          sizeBytes: 512,
          sha256: sharedSha256,
          uploadedBy: 'user-a',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const fileB = await prisma.prisma.sourceFile.create({
        data: {
          companyId: companyB.id,
          originalFilename: 'b.csv',
          storageKey: 'storage-' + uniqueId('key-b'),
          mimeType: 'text/csv',
          sizeBytes: 512,
          sha256: sharedSha256,
          uploadedBy: 'user-b',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      expect(fileA.sha256).toBe(sharedSha256);
      expect(fileB.sha256).toBe(sharedSha256);
      expect(fileA.companyId).not.toBe(fileB.companyId);

      await prisma.prisma.sourceFile.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    });

    it('rejects same-company duplicate SHA-256', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Dedup Co' },
      });

      const sha256 = 'dedup'.padEnd(64, '0');

      await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'first.csv',
          storageKey: 'storage-' + uniqueId('key-first'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256,
          uploadedBy: 'user-1',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      await expect(
        prisma.prisma.sourceFile.create({
          data: {
            companyId: company.id,
            originalFilename: 'second.csv',
            storageKey: 'storage-' + uniqueId('key-second'),
            mimeType: 'text/csv',
            sizeBytes: 100,
            sha256,
            uploadedBy: 'user-1',
            status: $Enums.SourceFileStatus.UPLOADED,
          },
        }),
      ).rejects.toThrow();

      await prisma.prisma.sourceFile.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('survives user deletion because uploadedBy is not a hard FK', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('sf-user'), email: `${uniqueId('sf-email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'User Del Co', ownerId: user.id },
      });

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'survive.csv',
          storageKey: 'storage-' + uniqueId('key-survive'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'survive'.padEnd(64, '0'),
          uploadedBy: user.id,
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      await prisma.prisma.user.delete({ where: { id: user.id } });

      const preserved = await prisma.prisma.sourceFile.findUnique({
        where: { id: sourceFile.id },
      });
      expect(preserved).toBeDefined();
      expect(preserved!.uploadedBy).toBe(user.id);

      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('ImportJob', () => {
    it('persists with required fields and nullable fields', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'ImportJob Test Co' },
      });
      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'import.csv',
          storageKey: 'storage-' + uniqueId('key-import'),
          mimeType: 'text/csv',
          sizeBytes: 200,
          sha256: 'import'.padEnd(64, '0'),
          uploadedBy: 'user-import',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: $Enums.FinancialStatementType.INCOME_STATEMENT,
          status: $Enums.ImportJobStatus.PARSED,
          createdBy: 'user-import',
          parseSummary: { rowCount: 10, headers: ['Revenue', 'Cost'] },
          committedStatementId: null,
          completedAt: null,
        },
      });

      expect(importJob.id).toBeDefined();
      expect(importJob.status).toBe($Enums.ImportJobStatus.PARSED);
      expect(importJob.committedStatementId).toBeNull();
      expect((importJob.parseSummary as any).rowCount).toBe(10);

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('persists with null statementType for UPLOADED status', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Null Type Co' },
      });
      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'nulltype.csv',
          storageKey: 'storage-' + uniqueId('key-nulltype'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'nulltype'.padEnd(64, '0'),
          uploadedBy: 'user-nulltype',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const importJob = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: null,
          status: $Enums.ImportJobStatus.UPLOADED,
          createdBy: 'user-nulltype',
        },
      });

      expect(importJob.id).toBeDefined();
      expect(importJob.status).toBe($Enums.ImportJobStatus.UPLOADED);
      expect(importJob.statementType).toBeNull();

      await prisma.prisma.importJob.delete({ where: { id: importJob.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('supports all V1 statuses', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Status Co' },
      });
      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'status.csv',
          storageKey: 'storage-' + uniqueId('key-status'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'status'.padEnd(64, '0'),
          uploadedBy: 'user-status',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const statuses = [
        $Enums.ImportJobStatus.UPLOADED,
        $Enums.ImportJobStatus.PARSED,
        $Enums.ImportJobStatus.NEEDS_MAPPING,
        $Enums.ImportJobStatus.MAPPED,
        $Enums.ImportJobStatus.VALIDATED,
        $Enums.ImportJobStatus.READY,
        $Enums.ImportJobStatus.COMPLETED,
        $Enums.ImportJobStatus.FAILED,
      ];

      for (const status of statuses) {
        const job = await prisma.prisma.importJob.create({
          data: {
            companyId: company.id,
            sourceFileId: sourceFile.id,
            statementType: $Enums.FinancialStatementType.BALANCE_SHEET,
            status,
            createdBy: 'user-status',
          },
        });
        expect(job.status).toBe(status);
        await prisma.prisma.importJob.delete({ where: { id: job.id } });
      }

      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('links SourceFile to ImportJob 1:N', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: '1N Co' },
      });
      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: '1n.csv',
          storageKey: 'storage-' + uniqueId('key-1n'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: '1n'.padEnd(64, '0'),
          uploadedBy: 'user-1n',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const job1 = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: $Enums.FinancialStatementType.CASH_FLOW,
          status: $Enums.ImportJobStatus.PARSED,
          createdBy: 'user-1n',
        },
      });

      const job2 = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: $Enums.FinancialStatementType.CASH_FLOW,
          status: $Enums.ImportJobStatus.COMPLETED,
          createdBy: 'user-1n',
        },
      });

      const fileWithJobs = await prisma.prisma.sourceFile.findUnique({
        where: { id: sourceFile.id },
        include: { importJobs: true },
      });

      expect(fileWithJobs?.importJobs.length).toBe(2);
      expect(fileWithJobs?.importJobs.map((j) => j.id).sort()).toEqual([job1.id, job2.id].sort());

      await prisma.prisma.importJob.deleteMany({ where: { sourceFileId: sourceFile.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('preserves ImportJob when SourceFile is deleted via RESTRICT', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'RESTRICT Co' },
      });
      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'restrict.csv',
          storageKey: 'storage-' + uniqueId('key-restrict'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'restrict'.padEnd(64, '0'),
          uploadedBy: 'user-restrict',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const job = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: $Enums.FinancialStatementType.INCOME_STATEMENT,
          status: $Enums.ImportJobStatus.UPLOADED,
          createdBy: 'user-restrict',
        },
      });

      await expect(
        prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } }),
      ).rejects.toThrow();

      await prisma.prisma.importJob.delete({ where: { id: job.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('cascades company deletion to SourceFile and ImportJob', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Cascade Co' },
      });
      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'cascade.csv',
          storageKey: 'storage-' + uniqueId('key-cascade'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'cascade'.padEnd(64, '0'),
          uploadedBy: 'user-cascade',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const job = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: $Enums.FinancialStatementType.INCOME_STATEMENT,
          status: $Enums.ImportJobStatus.UPLOADED,
          createdBy: 'user-cascade',
        },
      });

      await prisma.prisma.company.delete({ where: { id: company.id } });

      const preservedFile = await prisma.prisma.sourceFile.findUnique({ where: { id: sourceFile.id } });
      const preservedJob = await prisma.prisma.importJob.findUnique({ where: { id: job.id } });
      expect(preservedFile).toBeNull();
      expect(preservedJob).toBeNull();
    });
  });

  describe('tenant integrity', () => {
    it('rejects cross-company ImportJob.sourceFile at database level', async () => {
      const companyA = await prisma.prisma.company.create({ data: { name: 'Tenant A' } });
      const companyB = await prisma.prisma.company.create({ data: { name: 'Tenant B' } });

      const fileA = await prisma.prisma.sourceFile.create({
        data: {
          companyId: companyA.id,
          originalFilename: 'tenant-a.csv',
          storageKey: 'storage-' + uniqueId('key-tenant-a'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'tenant'.padEnd(64, '0'),
          uploadedBy: 'user-tenant',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      await expect(
        prisma.prisma.importJob.create({
          data: {
            companyId: companyB.id,
            sourceFileId: fileA.id,
            statementType: $Enums.FinancialStatementType.INCOME_STATEMENT,
            status: $Enums.ImportJobStatus.UPLOADED,
            createdBy: 'user-tenant',
          },
        }),
      ).rejects.toThrow();

      await prisma.prisma.sourceFile.delete({ where: { id: fileA.id } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    });

    it('allows same-company ImportJob.sourceFile via composite FK', async () => {
      const company = await prisma.prisma.company.create({ data: { name: 'Same Co' } });

      const sourceFile = await prisma.prisma.sourceFile.create({
        data: {
          companyId: company.id,
          originalFilename: 'same.csv',
          storageKey: 'storage-' + uniqueId('key-same'),
          mimeType: 'text/csv',
          sizeBytes: 100,
          sha256: 'same'.padEnd(64, '0'),
          uploadedBy: 'user-same',
          status: $Enums.SourceFileStatus.UPLOADED,
        },
      });

      const job = await prisma.prisma.importJob.create({
        data: {
          companyId: company.id,
          sourceFileId: sourceFile.id,
          statementType: $Enums.FinancialStatementType.INCOME_STATEMENT,
          status: $Enums.ImportJobStatus.UPLOADED,
          createdBy: 'user-same',
        },
      });

      expect(job.companyId).toBe(company.id);
      expect(job.sourceFileId).toBe(sourceFile.id);

      await prisma.prisma.importJob.delete({ where: { id: job.id } });
      await prisma.prisma.sourceFile.delete({ where: { id: sourceFile.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });
});
