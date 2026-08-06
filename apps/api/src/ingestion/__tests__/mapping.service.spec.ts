import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MappingService, MappingStatus, RowMapping, SheetMapping } from '../mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyAccessService } from '../../authorization/company-access.service';
import { AuditService } from '../../audit/audit.service';
import { ParsedTabularFile } from '../parsers/parse.types';

class MockCompanyAccessService {
  requireCompanyWrite = jest.fn();
}

const mockAuditService = {
  record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  recordInTransaction: jest.fn().mockResolvedValue({ id: 'audit-1' }),
};

describe('MappingService', () => {
  let service: MappingService;
  let mockCompanyAccessService: MockCompanyAccessService;
  let mockPrisma: any;

  const metricDefs = [
    { code: 'REVENUE', label: 'Revenue', category: 'Revenue', statementType: 'INCOME_STATEMENT' },
    { code: 'EXPENSES', label: 'Expenses', category: 'Operating Expenses', statementType: 'INCOME_STATEMENT' },
    { code: 'NET_INCOME', label: 'Net Income', category: 'Profitability', statementType: 'INCOME_STATEMENT' },
    { code: 'NET_INCOME', label: 'Net Income', category: 'Operating', statementType: 'CASH_FLOW' },
    { code: 'TOTAL_ASSETS', label: 'Total Assets', category: 'Assets', statementType: 'BALANCE_SHEET' },
  ];

  beforeEach(async () => {
    mockCompanyAccessService = new MockCompanyAccessService();
    mockPrisma = {
      user: { findUnique: jest.fn() },
      importJob: { findFirst: jest.fn(), updateMany: jest.fn() },
      metricDefinition: { findFirst: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MappingService,
        { provide: PrismaService, useValue: { prisma: mockPrisma } },
        { provide: CompanyAccessService, useValue: mockCompanyAccessService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<MappingService>(MappingService);
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'OWNER', email: 'user-1@test.com' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMapping', () => {
    it('auto-maps exact metric code match', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['REVENUE', '1000'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('AUTO_MAPPED');
      expect(rowMap.metricCode).toBe('REVENUE');
      expect(rowMap.statementType).toBe('INCOME_STATEMENT');
    });

    it('auto-maps exact metric label match (case-insensitive)', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['revenue', '1000'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('AUTO_MAPPED');
      expect(rowMap.metricCode).toBe('REVENUE');
    });

    it('auto-maps with whitespace normalization', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['  Total Assets  ', '500'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('AUTO_MAPPED');
      expect(rowMap.metricCode).toBe('TOTAL_ASSETS');
    });

    it('marks unknown metric as UNKNOWN', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Unknown Metric', '100'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('UNKNOWN');
      expect(rowMap.metricCode).toBeNull();
    });

    it('marks ambiguous metric (same code, multiple statement types) as AMBIGUOUS', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Net Income', '100'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('AMBIGUOUS');
      expect(rowMap.candidates.length).toBe(2);
    });

    it('does not fuzzy match - partial match is UNKNOWN', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Revenues', '100'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('UNKNOWN');
      expect(rowMap.metricCode).toBeNull();
    });

    it('all resolved means MAPPED status', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [
          { name: 'CSV', headers: ['Metric', 'Value'], rows: [
            { rowNumber: 1, values: ['Revenue', '1000'] },
            { rowNumber: 2, values: ['Expenses', '500'] },
          ] },
        ],
      };

      const result = service.generateMapping(parsed, metricDefs);
      expect(result.allResolved).toBe(true);
    });

    it('any unresolved means NEEDS_MAPPING status', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [
          { name: 'CSV', headers: ['Metric', 'Value'], rows: [
            { rowNumber: 1, values: ['Revenue', '1000'] },
            { rowNumber: 2, values: ['Unknown Metric', '500'] },
          ] },
        ],
      };

      const result = service.generateMapping(parsed, metricDefs);
      expect(result.allResolved).toBe(false);
    });

    it('preserves source headers separately in mapping', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', '2024'], rows: [{ rowNumber: 1, values: ['Revenue', '1000'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];

      expect(sheet.headers).toEqual(['Metric', '2024']);
      expect(sheet.columns[0].sourceHeader).toBe('Metric');
      expect(sheet.columns[1].sourceHeader).toBe('2024');
    });

    it('does not create custom MetricDefinitions', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Custom Metric XYZ', '100'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      const rowMap = sheet.rowMappings[0];

      expect(rowMap.status).toBe('UNKNOWN');
      expect(rowMap.metricCode).toBeNull();
    });

    it('mapping version is 1', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Revenue', '1000'] }] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      expect((result.mapping.version)).toBe(1);
    });

    it('handles multi-sheet files', () => {
      const parsed: ParsedTabularFile = {
        format: 'XLSX',
        sheets: [
          { name: 'Income', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Revenue', '1000'] }] },
          { name: 'Balance', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Total Assets', '500'] }] },
        ],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheets = result.mapping.sheets as SheetMapping[];
      expect(sheets.length).toBe(2);
      expect(sheets[0].sheetIndex).toBe(0);
      expect(sheets[1].sheetIndex).toBe(1);
    });

    it('handles blank vs zero in source values (raw staging preserves them)', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [
          { rowNumber: 1, values: ['Revenue', ''] },
          { rowNumber: 2, values: ['Expenses', '0'] },
        ] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      expect(sheet.rowMappings[0].sourceLabel).toBe('Revenue');
      expect(sheet.rowMappings[0].status).toBe('AUTO_MAPPED');
      expect(sheet.rowMappings[1].sourceLabel).toBe('Expenses');
      expect(sheet.rowMappings[1].status).toBe('AUTO_MAPPED');
    });

    it('preserves formula text and high precision values as sourceLabel', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [
          { rowNumber: 1, values: ['=A1+B1', ''] },
          { rowNumber: 2, values: ['Custom', '123.1234567'] },
        ] }],
      };

      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      expect(sheet.rowMappings[0].status).toBe('UNKNOWN');
      expect(sheet.rowMappings[0].sourceLabel).toBe('=A1+B1');
    });
  });

  describe('generateMapping - no fuzzy matching', () => {
    it('Revenue not fuzzy matched to Revenues', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Revenue', '100'] }] }],
      };
      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      expect(sheet.rowMappings[0].status).toBe('AUTO_MAPPED');
    });

    it('substring match is not fuzzy', () => {
      const parsed: ParsedTabularFile = {
        format: 'CSV',
        sheets: [{ name: 'CSV', headers: ['Metric', 'Value'], rows: [{ rowNumber: 1, values: ['Total Asset', '100'] }] }],
      };
      const result = service.generateMapping(parsed, metricDefs);
      const sheet = (result.mapping.sheets as SheetMapping[])[0];
      expect(sheet.rowMappings[0].status).toBe('UNKNOWN');
    });
  });

  describe('confirmMapping', () => {
    it('rejects when job not in NEEDS_MAPPING', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'MAPPED',
        mapping: { version: 1, sheets: [] },
      });

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', { sheets: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown metric code', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: {
          version: 1,
          sheets: [{ sheetIndex: 0, sheetName: 'CSV', headers: ['Metric', 'Value'], columns: [], rowMappings: [{ rowNumber: 1, sourceLabel: 'Unknown', metricCode: null, statementType: null, status: 'UNKNOWN', candidates: [] }] }],
        },
      });
      mockPrisma.metricDefinition.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', {
          sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'FAKE_METRIC' }] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate conflicting mapping', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: {
          version: 1,
          sheets: [{
            sheetIndex: 0, sheetName: 'CSV', headers: ['Metric', 'Value'], columns: [],
            rowMappings: [
              { rowNumber: 1, sourceLabel: 'A', metricCode: null, statementType: null, status: 'UNKNOWN', candidates: [] },
              { rowNumber: 2, sourceLabel: 'B', metricCode: null, statementType: null, status: 'UNKNOWN', candidates: [] },
            ],
          }],
        },
      });
      mockPrisma.metricDefinition.findFirst.mockResolvedValue({ code: 'REVENUE', label: 'Revenue', statementType: 'INCOME_STATEMENT', category: 'Revenue' });

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', {
          sheets: [{
            sheetIndex: 0,
            rowMappings: [
              { rowNumber: 1, metricCode: 'REVENUE' },
              { rowNumber: 2, metricCode: 'REVENUE' },
            ],
          }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects already auto-mapped row', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: {
          version: 1,
          sheets: [{
            sheetIndex: 0, sheetName: 'CSV', headers: ['Metric', 'Value'], columns: [],
            rowMappings: [{ rowNumber: 1, sourceLabel: 'Revenue', metricCode: 'REVENUE', statementType: 'INCOME_STATEMENT', status: 'AUTO_MAPPED', candidates: [] }],
          }],
        },
      });

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', {
          sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'EXPENSES' }] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid sheetIndex', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: { version: 1, sheets: [] },
      });

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', {
          sheets: [{ sheetIndex: 99, rowMappings: [] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid rowNumber', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: {
          version: 1,
          sheets: [{
            sheetIndex: 0, sheetName: 'CSV', headers: ['Metric', 'Value'], columns: [],
            rowMappings: [{ rowNumber: 1, sourceLabel: 'A', metricCode: null, statementType: null, status: 'UNKNOWN', candidates: [] }],
          }],
        },
      });

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', {
          sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 99, metricCode: 'REVENUE' }] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('transitions NEEDS_MAPPING to MAPPED when all resolved', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: {
          version: 1,
          sheets: [{
            sheetIndex: 0, sheetName: 'CSV', headers: ['Metric', 'Value'], columns: [],
            rowMappings: [
              { rowNumber: 1, sourceLabel: 'A', metricCode: null, statementType: 'INCOME_STATEMENT', status: 'UNKNOWN', candidates: [] },
            ],
          }],
        },
      });
      mockPrisma.metricDefinition.findFirst.mockResolvedValue({ code: 'REVENUE', label: 'Revenue', statementType: 'INCOME_STATEMENT', category: 'Revenue' });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTxClient));
      mockTxClient.importJob.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.confirmMapping('company-1', 'job-1', 'user-1', {
        sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'REVENUE' }] }],
      });

      expect(result.status).toBe('MAPPED');
      expect(mockTxClient.importJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', companyId: 'company-1', status: 'NEEDS_MAPPING' },
          data: expect.objectContaining({ status: 'MAPPED' }),
        }),
      );
    });

    it('rejects stale concurrent update', async () => {
      mockCompanyAccessService.requireCompanyWrite.mockResolvedValue(true);
      mockPrisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        companyId: 'company-1',
        status: 'NEEDS_MAPPING',
        mapping: {
          version: 1,
          sheets: [{
            sheetIndex: 0, sheetName: 'CSV', headers: ['Metric', 'Value'], columns: [],
            rowMappings: [{ rowNumber: 1, sourceLabel: 'A', metricCode: null, statementType: 'INCOME_STATEMENT', status: 'UNKNOWN', candidates: [] }],
          }],
        },
      });
      mockPrisma.metricDefinition.findFirst.mockResolvedValue({ code: 'REVENUE', label: 'Revenue', statementType: 'INCOME_STATEMENT', category: 'Revenue' });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTxClient));
      mockTxClient.importJob.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.confirmMapping('company-1', 'job-1', 'user-1', {
          sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'REVENUE' }] }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

const mockTxClient = {
  importJob: { updateMany: jest.fn() },
};
