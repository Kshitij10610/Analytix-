import { Test, TestingModule } from '@nestjs/testing';
import { StagingController } from '../staging.controller';
import { StagingService } from '../staging.service';
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

describe('StagingController', () => {
  let controller: StagingController;
  let stagingService: jest.Mocked<StagingService>;

  beforeEach(async () => {
    stagingService = {
      stageImportJob: jest.fn(),
    } as unknown as jest.Mocked<StagingService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StagingController],
      providers: [
        { provide: StagingService, useValue: stagingService },
        { provide: AccessTokenGuard, useClass: MockAccessTokenGuard },
        { provide: RolesGuard, useClass: MockRolesGuard },
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: Reflector, useValue: {} },
      ],
    }).compile();

    controller = module.get<StagingController>(StagingController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('stage', () => {
    it('delegates to service with correct arguments', async () => {
      const user = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' };
      stagingService.stageImportJob.mockResolvedValue({
        importJobId: 'job-1',
        status: 'MAPPED',
        stagedRowCount: 2,
        sheetCount: 1,
        mapping: { version: 1, orientation: 'ROW_ORIENTED', sheets: [] },
      });

      const result = await controller.stage(user, 'company-1', 'job-1');

      expect(stagingService.stageImportJob).toHaveBeenCalledWith('company-1', 'job-1', 'user-1');
      expect(result.status).toBe('MAPPED');
      expect(result.stagedRowCount).toBe(2);
    });

    it('propagates service errors', async () => {
      const user = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' };
      stagingService.stageImportJob.mockRejectedValue(new BadRequestException('Invalid state'));

      await expect(controller.stage(user, 'company-1', 'job-1')).rejects.toThrow(BadRequestException);
    });
  });
});
