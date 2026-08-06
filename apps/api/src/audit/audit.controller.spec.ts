import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from './audit.constants';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;
  let accessService: jest.Mocked<CompanyAccessService>;

  beforeEach(() => {
    auditService = {
      record: jest.fn(),
      recordInTransaction: jest.fn(),
      readEventsByCompany: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    accessService = {
      requireCompanyRead: jest.fn(),
      requireCompanyWrite: jest.fn(),
      requireCompanyOwnerOrAdmin: jest.fn(),
      buildScopedCompanyWhere: jest.fn(),
    } as unknown as jest.Mocked<CompanyAccessService>;

    controller = new AuditController(auditService, accessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findCompanyAuditEvents', () => {
    const mockUser = { userId: 'user-1', email: 'user@test.com', role: 'OWNER' };
    const companyId = 'company-1';

    it('should allow OWNER to read company audit history', async () => {
      const events = [
        {
          id: 'event-1',
          occurredAt: new Date('2024-01-02T00:00:00Z'),
          actor: { type: AuditActorType.USER, userId: 'user-1', email: 'user@test.com', globalRole: 'USER' },
          action: AuditAction.COMPANY_CREATE,
          resource: { type: AuditResourceType.COMPANY, id: companyId },
          result: AuditResult.SUCCESS,
        },
      ];
      auditService.readEventsByCompany.mockResolvedValue({ events, nextCursor: null });

      const result = await controller.findCompanyAuditEvents(mockUser, companyId, {});

      expect(accessService.requireCompanyRead).toHaveBeenCalledWith('user-1', companyId, 'OWNER');
      expect(result).toEqual({ events, nextCursor: null });
    });

    it('should allow EDITOR to read company audit history', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });

      await controller.findCompanyAuditEvents({ ...mockUser, role: 'EDITOR' }, companyId, {});

      expect(accessService.requireCompanyRead).toHaveBeenCalledWith('user-1', companyId, 'EDITOR');
    });

    it('should allow VIEWER to read company audit history', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });

      await controller.findCompanyAuditEvents({ ...mockUser, role: 'VIEWER' }, companyId, {});

      expect(accessService.requireCompanyRead).toHaveBeenCalledWith('user-1', companyId, 'VIEWER');
    });

    it('should allow ADMIN without membership to read', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });

      await controller.findCompanyAuditEvents({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' }, companyId, {});

      expect(accessService.requireCompanyRead).toHaveBeenCalledWith('admin-1', companyId, 'ADMIN');
    });

    it('should return 404 for no membership', async () => {
      accessService.requireCompanyRead.mockRejectedValue(new NotFoundException('Company not found'));

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, {})).rejects.toThrow('Company not found');
    });

    it('should return 404 for missing company', async () => {
      accessService.requireCompanyRead.mockRejectedValue(new NotFoundException('Company not found'));

      await expect(controller.findCompanyAuditEvents(mockUser, 'missing-company', {})).rejects.toThrow('Company not found');
    });

    it('should apply default limit of 50', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });

      await controller.findCompanyAuditEvents(mockUser, companyId, {});

      expect(auditService.readEventsByCompany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it('should reject limit outside 1-100 range', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { limit: -1 })).rejects.toThrow(BadRequestException);
      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { limit: 0 })).rejects.toThrow(BadRequestException);
      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { limit: 200 })).rejects.toThrow(BadRequestException);
    });

    it('should pass authorization info without side effects for ADMIN', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });

      await controller.findCompanyAuditEvents({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' }, companyId, {});

      expect(accessService.requireCompanyRead).toHaveBeenCalledWith('admin-1', companyId, 'ADMIN');
    });

    it('should reject invalid action filter', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { action: 'INVALID_ACTION' as any })).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid resourceType filter', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { resourceType: 'INVALID_RESOURCE' as any })).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid result filter', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { result: 'INVALID_RESULT' as any })).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid date', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { from: 'not-a-date' })).rejects.toThrow(BadRequestException);
      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { to: 'not-a-date' })).rejects.toThrow(BadRequestException);
    });

    it('should reject from > to', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(
        controller.findCompanyAuditEvents(mockUser, companyId, { from: '2024-12-31', to: '2024-01-01' }),
      ).rejects.toThrow('from must be less than or equal to to');
    });

    it('should reject invalid cursor', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });

      await expect(controller.findCompanyAuditEvents(mockUser, companyId, { cursor: 'not-valid-base64' })).rejects.toThrow('Invalid cursor');
    });

    it('should pass valid filters to service', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });

      await controller.findCompanyAuditEvents(mockUser, companyId, {
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        actorUserId: 'actor-1',
        result: AuditResult.SUCCESS,
        from: '2024-01-01',
        to: '2024-12-31',
      });

      expect(auditService.readEventsByCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          actorUserId: 'actor-1',
          result: AuditResult.SUCCESS,
          from: expect.any(Date),
          to: expect.any(Date),
        }),
      );
    });

    it('should parse cursor and pass cursor fields', async () => {
      accessService.requireCompanyRead.mockResolvedValue({} as { id: string });
      auditService.readEventsByCompany.mockResolvedValue({ events: [], nextCursor: null });
      const cursor = Buffer.from(JSON.stringify({ occurredAt: '2024-01-01T00:00:00.000Z', id: 'event-1' })).toString('base64');

      await controller.findCompanyAuditEvents(mockUser, companyId, { cursor });

      expect(auditService.readEventsByCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursorOccurredAt: expect.any(Date),
          cursorId: 'event-1',
        }),
      );
    });
  });
});
