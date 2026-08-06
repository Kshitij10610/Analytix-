import { Test, TestingModule } from '@nestjs/testing';
import { MappingController } from '../mapping.controller';
import { MappingService } from '../mapping.service';
import { BadRequestException } from '@nestjs/common';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthService } from '../../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

class MockAccessTokenGuard {
  canActivate = jest.fn(() => true);
}

class MockRolesGuard {
  canActivate = jest.fn(() => true);
}

describe('MappingController', () => {
  let controller: MappingController;
  let mappingService: jest.Mocked<MappingService>;

  beforeEach(async () => {
    mappingService = {
      confirmMapping: jest.fn(),
    } as unknown as jest.Mocked<MappingService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MappingController],
      providers: [
        { provide: MappingService, useValue: mappingService },
        { provide: AccessTokenGuard, useClass: MockAccessTokenGuard },
        { provide: RolesGuard, useClass: MockRolesGuard },
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: Reflector, useValue: {} },
      ],
    }).compile();

    controller = module.get<MappingController>(MappingController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('confirmMapping', () => {
    it('delegates to service with correct arguments', async () => {
      const user = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' };
      const body = { sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'REVENUE' }] }] };

      mappingService.confirmMapping.mockResolvedValue({
        importJobId: 'job-1',
        status: 'MAPPED',
        mapping: { version: 1, orientation: 'ROW_ORIENTED', sheets: [] },
      });

      const result = await controller.confirmMapping(user, 'company-1', 'job-1', body);

      expect(mappingService.confirmMapping).toHaveBeenCalledWith('company-1', 'job-1', 'user-1', body);
      expect(result.status).toBe('MAPPED');
    });

    it('propagates service errors', async () => {
      const user = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' };
      const body = { sheets: [{ sheetIndex: 0, rowMappings: [{ rowNumber: 1, metricCode: 'FAKE' }] }] };

      mappingService.confirmMapping.mockRejectedValue(new BadRequestException('Unknown metric code'));

      await expect(controller.confirmMapping(user, 'company-1', 'job-1', body)).rejects.toThrow(BadRequestException);
    });
  });
});
