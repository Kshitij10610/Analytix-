import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditActorType,
  AuditAction,
  AuditResourceType,
  AuditResult,
} from '../audit.constants';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      auditEvent: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('record', () => {
    it('should create audit event with valid data', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' } as any);

      const result = await service.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-1',
        actorEmail: 'test@example.com',
        actorGlobalRole: 'USER',
        companyId: 'company-1',
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: 'company-1',
        result: AuditResult.SUCCESS,
        changes: { name: { before: null, after: 'Acme' } },
        metadata: { source: 'api' },
      });

      expect(result.id).toBe('audit-1');
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          result: AuditResult.SUCCESS,
          changes: { name: { before: null, after: 'Acme' } },
          metadata: { source: 'api' },
        }),
        select: { id: true },
      });
    });

    it('should throw InternalServerErrorException when audit insert fails', async () => {
      mockPrisma.auditEvent.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.record({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          result: AuditResult.SUCCESS,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('recordInTransaction', () => {
    it('should create audit event using transaction client', async () => {
      const mockTx = {
        auditEvent: {
          create: jest.fn().mockResolvedValue({ id: 'audit-tx-1' }),
        },
      } as any;

      const result = await service.recordInTransaction(
        {
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          result: AuditResult.SUCCESS,
        },
        mockTx,
      );

      expect(result.id).toBe('audit-tx-1');
      expect(mockTx.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorType: AuditActorType.USER,
          action: AuditAction.COMPANY_CREATE,
        }),
        select: { id: true },
      });
    });

    it('should throw InternalServerErrorException when transactional audit insert fails', async () => {
      const mockTx = {
        auditEvent: {
          create: jest.fn().mockRejectedValue(new Error('tx error')),
        },
      } as any;

      await expect(
        service.recordInTransaction(
          {
            actorType: AuditActorType.USER,
            actorUserId: 'user-1',
            action: AuditAction.COMPANY_CREATE,
            resourceType: AuditResourceType.COMPANY,
            result: AuditResult.SUCCESS,
          },
          mockTx,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('validation', () => {
    it('should throw InternalServerErrorException for missing action', async () => {
      await expect(
        service.record({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          resourceType: AuditResourceType.COMPANY,
          result: AuditResult.SUCCESS,
        } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException for missing resourceType', async () => {
      await expect(
        service.record({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          action: AuditAction.COMPANY_CREATE,
          result: AuditResult.SUCCESS,
        } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException for missing result', async () => {
      await expect(
        service.record({
          actorType: AuditActorType.USER,
          actorUserId: 'user-1',
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
        } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when USER actorType lacks actorUserId', async () => {
      await expect(
        service.record({
          actorType: AuditActorType.USER,
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          result: AuditResult.SUCCESS,
        } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should allow SYSTEM actorType without actorUserId', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-sys' } as any);

      const result = await service.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.AUTH_LOGIN_SUCCESS,
        resourceType: AuditResourceType.AUTH_SESSION,
        result: AuditResult.SUCCESS,
      });

      expect(result.id).toBe('audit-sys');
    });
  });

  describe('sanitization', () => {
    it('should redact nested sensitive fields', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-2' } as any);

      await service.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-1',
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        result: AuditResult.SUCCESS,
        changes: {
          password: 'secret123',
          nested: {
            refreshToken: 'token-abc',
            safeField: 'keep',
          },
          array: [
            {
              authorization: 'Bearer xyz',
              name: 'test',
            },
          ],
        },
      });

      const callArgs = mockPrisma.auditEvent.create.mock.calls[0][0].data;
      expect(callArgs.changes).toEqual({
        password: '[REDACTED]',
        nested: {
          refreshToken: '[REDACTED]',
          safeField: 'keep',
        },
        array: [
          {
            authorization: '[REDACTED]',
            name: 'test',
          },
        ],
      });
    });

    it('should preserve exact decimal strings', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-3' } as any);

      await service.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-1',
        action: AuditAction.LINE_ITEM_CREATE,
        resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
        result: AuditResult.SUCCESS,
        changes: {
          value: '1250000000.500000',
        },
      });

      const callArgs = mockPrisma.auditEvent.create.mock.calls[0][0].data;
      expect(callArgs.changes).toEqual({
        value: '1250000000.500000',
      });
    });

    it('should handle null and undefined safely', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-4' } as any);

      await service.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-1',
        action: AuditAction.COMPANY_UPDATE,
        resourceType: AuditResourceType.COMPANY,
        result: AuditResult.SUCCESS,
        changes: null,
        metadata: undefined,
      });

      const callArgs = mockPrisma.auditEvent.create.mock.calls[0][0].data;
      expect(callArgs.changes).toBeNull();
      expect(callArgs.metadata).toBeUndefined();
    });

    it('should not mutate caller input', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-5' } as any);

      const inputChanges = {
        password: 'secret',
        safe: 'value',
      };

      await service.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-1',
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        result: AuditResult.SUCCESS,
        changes: inputChanges,
      });

      expect(inputChanges).toEqual({
        password: 'secret',
        safe: 'value',
      });
    });
  });
});
