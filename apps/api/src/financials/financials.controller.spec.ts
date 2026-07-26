import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialsController],
      providers: [
        {
          provide: FinancialsService,
          useValue: {
            create: jest.fn(),
            findByCompany: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AccessTokenGuard,
          useClass: MockAccessTokenGuard,
        },
        {
          provide: RolesGuard,
          useClass: MockRolesGuard,
        },
      ],
    }).compile();

    controller = module.get<FinancialsController>(FinancialsController);
    service = module.get<FinancialsService>(FinancialsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a financial statement', async () => {
    const dto = { type: 'INCOME_STATEMENT', periodStart: '2024-01-01', periodEnd: '2024-12-31' } as const;
    const result = { id: '1', companyId: '1', ...dto };
    jest.spyOn(service, 'create').mockResolvedValue(result as any);

    expect(await controller.createForCompany('1', dto)).toBe(result);
    expect(service.create).toHaveBeenCalledWith('1', {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });
  });

  it('should return financial statements for a company', async () => {
    const statements = [{ id: '1', companyId: '1', type: 'INCOME_STATEMENT' }];
    jest.spyOn(service, 'findByCompany').mockResolvedValue(statements as any);

    expect(await controller.findByCompany('1')).toBe(statements);
  });

  it('should return one financial statement', async () => {
    const statement = { id: '1', companyId: '1', type: 'INCOME_STATEMENT' };
    jest.spyOn(service, 'findOne').mockResolvedValue(statement as any);

    expect(await controller.findOne('1')).toBe(statement);
  });

  it('should throw NotFoundException for missing company', async () => {
    jest.spyOn(service, 'create').mockRejectedValue(new NotFoundException('Not found'));

    await expect(
      controller.createForCompany('999', {
        type: 'INCOME_STATEMENT',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
      } as const),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for invalid dates', async () => {
    jest.spyOn(service, 'create').mockRejectedValue(new BadRequestException('Invalid dates'));

    await expect(
      controller.createForCompany('1', {
        type: 'INCOME_STATEMENT',
        periodStart: '2024-12-31',
        periodEnd: '2024-01-01',
      } as const),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update a financial statement', async () => {
    const dto = { type: 'BALANCE_SHEET' as const };
    const result = { id: '1', companyId: '1', type: 'BALANCE_SHEET' };
    jest.spyOn(service, 'update').mockResolvedValue(result as any);

    expect(await controller.update('1', dto)).toBe(result);
    expect(service.update).toHaveBeenCalledWith('1', { type: 'BALANCE_SHEET' });
  });

  it('should delete a financial statement', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue(undefined);

    await controller.remove('1');
    expect(service.remove).toHaveBeenCalledWith('1');
  });

  it('should throw NotFoundException when deleting non-existent statement', async () => {
    jest.spyOn(service, 'remove').mockRejectedValue(new NotFoundException('Not found'));

    await expect(controller.remove('999')).rejects.toThrow(NotFoundException);
  });
});
