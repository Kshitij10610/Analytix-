import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LineItemsController } from './line-items.controller';
import { LineItemsService } from './line-items.service';
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

describe('LineItemsController', () => {
  let controller: LineItemsController;
  let service: LineItemsService;

  const mockUser = { userId: 'user-1', email: 'user@test.com', role: 'ANALYST' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LineItemsController],
      providers: [
        {
          provide: LineItemsService,
          useValue: {
            findByStatement: jest.fn(),
            create: jest.fn(),
            replaceLineItems: jest.fn(),
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

    controller = module.get<LineItemsController>(LineItemsController);
    service = module.get<LineItemsService>(LineItemsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findByStatement should call service with user', async () => {
    jest.spyOn(service, 'findByStatement').mockResolvedValue([{ id: 'li-1' }] as any);
    const result = await controller.findByStatement(mockUser, 'stmt-1');
    expect(result).toEqual([{ id: 'li-1' }]);
    expect(service.findByStatement).toHaveBeenCalledWith('stmt-1', 'user-1', 'ANALYST');
  });

  it('create should call service with user', async () => {
    jest.spyOn(service, 'create').mockResolvedValue({ id: 'li-1' } as any);
    const dto = { metricCode: 'REVENUE', value: '1000.500000' };
    const result = await controller.createForStatement(mockUser, 'stmt-1', dto);
    expect(result).toEqual({ id: 'li-1' });
    expect(service.create).toHaveBeenCalledWith('stmt-1', 'REVENUE', {
      value: '1000.500000',
      labelOverride: undefined,
      displayOrder: undefined,
    }, 'user-1', 'ANALYST', 'user@test.com');
  });

  it('replace should call service with user', async () => {
    jest.spyOn(service, 'replaceLineItems').mockResolvedValue([{ id: 'li-1' }] as any);
    const dto = { lineItems: [{ metricCode: 'REVENUE', value: '1000.500000' }] };
    const result = await controller.replaceForStatement(mockUser, 'stmt-1', dto);
    expect(result).toEqual([{ id: 'li-1' }]);
    expect(service.replaceLineItems).toHaveBeenCalledWith('stmt-1', dto.lineItems, 'user-1', 'ANALYST', 'user@test.com');
  });

  it('update should call service with user', async () => {
    jest.spyOn(service, 'update').mockResolvedValue({ id: 'li-1', value: '2000.500000' } as any);
    const dto = { value: '2000.500000' };
    const result = await controller.update(mockUser, 'li-1', dto);
    expect(result).toEqual({ id: 'li-1', value: '2000.500000' });
    expect(service.update).toHaveBeenCalledWith('li-1', { value: '2000.500000' }, 'user-1', 'ANALYST', 'user@test.com');
  });

  it('remove should call service with user', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue(undefined);
    await controller.remove(mockUser, 'li-1');
    expect(service.remove).toHaveBeenCalledWith('li-1', 'user-1', 'ANALYST', 'user@test.com');
  });
});
