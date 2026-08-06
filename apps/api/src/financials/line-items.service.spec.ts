import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { LineItemsService } from './line-items.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';

describe('LineItemsService', () => {
  let service: LineItemsService;
  let accessService: jest.Mocked<CompanyAccessService>;
  let auditService: jest.Mocked<AuditService>;

  const mockPrisma = {
    financialStatement: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    metricDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    financialLineItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    accessService = {
      requireCompanyRead: jest.fn(),
      requireCompanyWrite: jest.fn(),
      buildScopedCompanyWhere: jest.fn(),
    } as unknown as jest.Mocked<CompanyAccessService>;

    auditService = {
      record: jest.fn(),
      recordInTransaction: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineItemsService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
        {
          provide: CompanyAccessService,
          useValue: accessService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<LineItemsService>(LineItemsService);

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        financialStatement: { create: mockPrisma.financialStatement.create },
        financialLineItem: {
          create: mockPrisma.financialLineItem.create,
          update: mockPrisma.financialLineItem.update,
          delete: mockPrisma.financialLineItem.delete,
          deleteMany: mockPrisma.financialLineItem.deleteMany,
        },
      };
      return cb(tx);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByStatement', () => {
    it('should return line items when user has access', async () => {
      accessService.requireCompanyRead.mockResolvedValue({ id: '1' });
      mockPrisma.financialStatement.findUnique.mockResolvedValue({ id: 'stmt-1', companyId: '1' });
      mockPrisma.financialLineItem.findMany.mockResolvedValue([
        { id: 'li-1', metric_definitions: { code: 'REVENUE' }, value: '1000.500000' },
      ]);

      const result = await service.findByStatement('stmt-1', 'user-1', 'ANALYST');

      expect(result).toHaveLength(1);
      expect(accessService.requireCompanyRead).toHaveBeenCalledWith('user-1', '1', 'ANALYST');
    });

    it('should throw NotFoundException for missing statement', async () => {
      mockPrisma.financialStatement.findUnique.mockResolvedValue(null);
      await expect(service.findByStatement('missing', 'user-1', 'ANALYST')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user has no access', async () => {
      accessService.requireCompanyRead.mockRejectedValue(new NotFoundException('Company not found'));
      mockPrisma.financialStatement.findUnique.mockResolvedValue({ id: 'stmt-1', companyId: '1' });

      await expect(service.findByStatement('stmt-1', 'user-1', 'ANALYST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a line item when user has write access', async () => {
      mockPrisma.financialStatement.findUnique.mockResolvedValue({ id: 'stmt-1', type: 'INCOME_STATEMENT', companyId: '1' });
      accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.metricDefinition.findFirst.mockResolvedValue({ id: 'metric-1', code: 'REVENUE' });
      mockPrisma.financialLineItem.create.mockResolvedValue({
        id: 'li-1',
        value: '1000.500000',
        metric_definitions: { code: 'REVENUE' },
      });

      const result = await service.create('stmt-1', 'REVENUE', { value: '1000.500000' }, 'user-1', 'ANALYST', 'actor@test.com');

      expect(result).toBeDefined();
      expect(accessService.requireCompanyWrite).toHaveBeenCalledWith('user-1', '1', 'ANALYST');
      expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
      expect(auditService.recordInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          actorEmail: 'actor@test.com',
          actorGlobalRole: 'ANALYST',
          companyId: '1',
          action: AuditAction.LINE_ITEM_CREATE,
          resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
          resourceId: 'li-1',
          result: AuditResult.SUCCESS,
          changes: expect.objectContaining({
            value: { before: null, after: '1000.500000' },
          }),
          metadata: expect.objectContaining({
            statementId: 'stmt-1',
            metricCode: 'REVENUE',
          }),
        }),
        expect.anything(),
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing statement', async () => {
      mockPrisma.financialStatement.findUnique.mockResolvedValue(null);
      await expect(service.create('missing', 'REVENUE', { value: '1000' }, 'user-1', 'ANALYST', 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when viewer attempts create', async () => {
      mockPrisma.financialStatement.findUnique.mockResolvedValue({ id: 'stmt-1', type: 'INCOME_STATEMENT', companyId: '1' });
      accessService.requireCompanyWrite.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(service.create('stmt-1', 'REVENUE', { value: '1000' }, 'user-1', 'ANALYST', 'actor@test.com')).rejects.toThrow(ForbiddenException);
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const fakeDecimal = { toFixed: (n: number) => '1000.500000' };
    it('should update line item when user has write access', async () => {
      mockPrisma.financialLineItem.findUnique.mockResolvedValue({ 
        id: 'li-1', 
        financial_statements: { companyId: '1' },
        value: fakeDecimal,
        labelOverride: null,
        displayOrder: null,
      });
      accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.financialLineItem.update.mockResolvedValue({ id: 'li-1', value: '2000.500000' });

      const result = await service.update('li-1', { value: '2000.500000' }, 'user-1', 'ANALYST', 'actor@test.com');

      expect(result).toBeDefined();
      expect(accessService.requireCompanyWrite).toHaveBeenCalledWith('user-1', '1', 'ANALYST');
      expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
      expect(auditService.recordInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          actorEmail: 'actor@test.com',
          actorGlobalRole: 'ANALYST',
          companyId: '1',
          action: AuditAction.LINE_ITEM_UPDATE,
          resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
          resourceId: 'li-1',
          result: AuditResult.SUCCESS,
          changes: expect.objectContaining({
            value: { before: '1000.500000', after: '2000.500000' },
          }),
        }),
        expect.anything(),
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing line item', async () => {
      mockPrisma.financialLineItem.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { value: '1000' }, 'user-1', 'ANALYST', 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when viewer attempts update', async () => {
      mockPrisma.financialLineItem.findUnique.mockResolvedValue({ id: 'li-1', financial_statements: { companyId: '1' } });
      accessService.requireCompanyWrite.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(service.update('li-1', { value: '1000' }, 'user-1', 'ANALYST', 'actor@test.com')).rejects.toThrow(ForbiddenException);
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const fakeDecimal = { toFixed: (n: number) => '1000.500000' };
    it('should allow admin to delete line item', async () => {
      mockPrisma.financialLineItem.findUnique.mockResolvedValue({ 
        id: 'li-1', 
        financial_statements: { companyId: '1' },
        metric_definitions: { code: 'REVENUE' },
        value: fakeDecimal,
        labelOverride: null,
        displayOrder: null,
        financialStatementId: 'stmt-1',
      });
      mockPrisma.financialLineItem.delete.mockResolvedValue({ id: 'li-1' });

      await service.remove('li-1', 'admin-1', 'ADMIN', 'actor@test.com');

      expect(mockPrisma.financialLineItem.delete).toHaveBeenCalledWith({ where: { id: 'li-1' } });
      expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
      expect(auditService.recordInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: AuditActorType.USER,
          actorUserId: 'admin-1',
          actorEmail: 'actor@test.com',
          actorGlobalRole: 'ADMIN',
          companyId: '1',
          action: AuditAction.LINE_ITEM_DELETE,
          resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
          resourceId: 'li-1',
          result: AuditResult.SUCCESS,
          changes: expect.objectContaining({
            value: { before: '1000.500000', after: null },
          }),
          metadata: expect.objectContaining({
            statementId: 'stmt-1',
            metricCode: 'REVENUE',
          }),
        }),
        expect.anything(),
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-admin attempts delete', async () => {
      await expect(service.remove('li-1', 'user-1', 'ANALYST', 'actor@test.com')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.financialLineItem.delete).not.toHaveBeenCalled();
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing line item', async () => {
      const notFoundError = new Error('not found') as Error & { code?: string };
      notFoundError.code = 'P2025';
      mockPrisma.financialLineItem.findUnique.mockResolvedValue(null);
      mockPrisma.financialLineItem.delete.mockRejectedValue(notFoundError);
      await expect(service.remove('missing', 'admin-1', 'ADMIN', 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('replaceLineItems', () => {
    it('should replace line items when user has write access', async () => {
      const fakeDecimal = { toFixed: (n: number) => '1000.500000' };
      mockPrisma.financialStatement.findUnique.mockResolvedValue({ id: 'stmt-1', type: 'INCOME_STATEMENT', companyId: '1' });
      accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.financialLineItem.findMany.mockResolvedValue([
        { id: 'li-1', metric_definitions: { code: 'REVENUE' }, value: fakeDecimal, labelOverride: null, displayOrder: null },
      ]);
      mockPrisma.financialLineItem.deleteMany.mockResolvedValue({ count: 0 } as any);
      mockPrisma.metricDefinition.findMany.mockResolvedValue([{ id: 'metric-1', code: 'REVENUE' }]);
      mockPrisma.financialLineItem.create.mockResolvedValue({ id: 'li-1' });

      const result = await service.replaceLineItems('stmt-1', [{ metricCode: 'REVENUE', value: '1000' }], 'user-1', 'ANALYST', 'actor@test.com');

      expect(result).toHaveLength(1);
      expect(accessService.requireCompanyWrite).toHaveBeenCalledWith('user-1', '1', 'ANALYST');
      expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
      expect(auditService.recordInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          actorEmail: 'actor@test.com',
          actorGlobalRole: 'ANALYST',
          companyId: '1',
          action: AuditAction.LINE_ITEMS_REPLACE,
          resourceType: AuditResourceType.FINANCIAL_STATEMENT,
          resourceId: 'stmt-1',
          result: AuditResult.SUCCESS,
          metadata: expect.objectContaining({
            beforeCount: 1,
            afterCount: 1,
            addedMetricCodes: [],
            removedMetricCodes: [],
            updatedMetricCodes: ['REVENUE'],
          }),
        }),
        expect.anything(),
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing statement', async () => {
      mockPrisma.financialStatement.findUnique.mockResolvedValue(null);
      await expect(service.replaceLineItems('missing', [], 'user-1', 'ANALYST', 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(auditService.recordInTransaction).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });
});
