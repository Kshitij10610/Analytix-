import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
class MockAccessTokenGuard {
  canActivate = jest.fn(() => true);
}

@Injectable()
class MockRolesGuard {
  canActivate = jest.fn(() => true);
}

describe('FinancialsController', () => {
  let controller: FinancialsController;
  let service: FinancialsService;

  const mockUser = { userId: 'user-1', email: 'user@test.com', role: 'ANALYST' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialsController],
      providers: [
        {
          provide: FinancialsService,
          useValue: {
            create: jest.fn(),
            createWithLineItems: jest.fn(),
            findByCompany: jest.fn(),
            findOne: jest.fn(),
            findOneWithLineItems: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: AccessTokenGuard, useClass: MockAccessTokenGuard },
        { provide: RolesGuard, useClass: MockRolesGuard },
      ],
    }).compile();

    controller = module.get<FinancialsController>(FinancialsController);
    service = module.get<FinancialsService>(FinancialsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a financial statement with line items', async () => {
    const dto = {
      type: 'INCOME_STATEMENT' as const,
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
      fiscalYear: 2024,
      periodType: 'ANNUAL' as const,
      currency: 'USD',
      scale: 'ONES' as const,
      lineItems: [{ metricCode: 'REVENUE', value: '1000.500000' }],
    };
    const result = { id: '1', companyId: '1', ...dto };
    jest.spyOn(service, 'createWithLineItems').mockResolvedValue(result as any);

    expect(await controller.createForCompany(mockUser, '1', dto)).toBe(result);
    expect(service.createWithLineItems).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ type: 'INCOME_STATEMENT', fiscalYear: 2024 }),
      [{ metricCode: 'REVENUE', value: '1000.500000' }],
      'user-1',
      'ANALYST',
      'user@test.com',
    );
  });

  it('should return financial statements for a company', async () => {
    const statements = [{ id: '1', companyId: '1', type: 'INCOME_STATEMENT' }];
    jest.spyOn(service, 'findByCompany').mockResolvedValue(statements as any);

    expect(await controller.findByCompany(mockUser, '1')).toBe(statements);
    expect(service.findByCompany).toHaveBeenCalledWith('1', 'user-1', 'ANALYST');
  });

  it('should return one financial statement with line items', async () => {
    const result = { id: '1', companyId: '1', type: 'INCOME_STATEMENT', lineItems: [] };
    jest.spyOn(service, 'findOneWithLineItems').mockResolvedValue(result as any);

    const response = await controller.findOneWithLineItems(mockUser, '1');
    expect(response).toBe(result);
    expect(service.findOneWithLineItems).toHaveBeenCalledWith('1', 'user-1', 'ANALYST');
  });

  it('should throw NotFoundException for missing company on create', async () => {
    jest.spyOn(service, 'createWithLineItems').mockRejectedValue(new NotFoundException('Not found'));

    await expect(
      controller.createForCompany(mockUser, '999', {
        type: 'INCOME_STATEMENT',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        fiscalYear: 2024,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for invalid dates', async () => {
    jest.spyOn(service, 'createWithLineItems').mockRejectedValue(new BadRequestException('Invalid dates'));

    await expect(
      controller.createForCompany(mockUser, '1', {
        type: 'INCOME_STATEMENT',
        periodStart: '2024-12-31',
        periodEnd: '2024-01-01',
        fiscalYear: 2024,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update a financial statement', async () => {
    const dto = { type: 'BALANCE_SHEET' as const };
    const result = { id: '1', companyId: '1', type: 'BALANCE_SHEET' };
    jest.spyOn(service, 'update').mockResolvedValue(result as any);

    expect(await controller.update(mockUser, '1', dto)).toBe(result);
    expect(service.update).toHaveBeenCalledWith('1', { type: 'BALANCE_SHEET' }, 'user-1', 'ANALYST', 'user@test.com');
  });

  it('should delete a financial statement', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue(undefined);

    await controller.remove(mockUser, '1');
    expect(service.remove).toHaveBeenCalledWith('1', 'user-1', 'ANALYST', 'user@test.com');
  });

  it('should throw NotFoundException when deleting non-existent statement', async () => {
    jest.spyOn(service, 'remove').mockRejectedValue(new NotFoundException('Not found'));

    await expect(controller.remove(mockUser, '999')).rejects.toThrow(NotFoundException);
  });
});
