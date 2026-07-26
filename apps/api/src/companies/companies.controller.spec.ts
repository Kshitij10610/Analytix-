import { Injectable, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
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

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: CompaniesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
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

    controller = module.get<CompaniesController>(CompaniesController);
    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a company', async () => {
    const dto = { name: 'Test Corp', industry: 'Tech', website: 'https://test.com' };
    const result = { id: '1', ...dto, createdAt: new Date(), updatedAt: new Date() };
    jest.spyOn(service, 'create').mockResolvedValue(result);

    expect(await controller.create(dto)).toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all companies', async () => {
    const companies = [{ id: '1', name: 'Test Corp', industry: 'Tech', website: 'https://test.com', createdAt: new Date(), updatedAt: new Date() }];
    jest.spyOn(service, 'findAll').mockResolvedValue(companies);

    expect(await controller.findAll()).toBe(companies);
  });

  it('should return one company', async () => {
    const company = { id: '1', name: 'Test Corp', industry: 'Tech', website: 'https://test.com', createdAt: new Date(), updatedAt: new Date() };
    jest.spyOn(service, 'findOne').mockResolvedValue(company);

    expect(await controller.findOne('1')).toBe(company);
  });

  it('should throw NotFoundException for missing company', async () => {
    jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException('Not found'));

    await expect(controller.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('should update a company', async () => {
    const dto = { name: 'Updated' };
    const result = { id: '1', name: 'Updated', industry: 'Tech', website: 'https://test.com', createdAt: new Date(), updatedAt: new Date() };
    jest.spyOn(service, 'update').mockResolvedValue(result);

    expect(await controller.update('1', dto)).toBe(result);
    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('should delete a company', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue(undefined);

    await controller.remove('1');
    expect(service.remove).toHaveBeenCalledWith('1');
  });

  it('should throw NotFoundException when deleting non-existent company', async () => {
    jest.spyOn(service, 'remove').mockRejectedValue(new NotFoundException('Not found'));

    await expect(controller.remove('999')).rejects.toThrow(NotFoundException);
  });
});
