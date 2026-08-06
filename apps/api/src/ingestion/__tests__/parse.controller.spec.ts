import { Test, TestingModule } from '@nestjs/testing';
import { ParseController } from '../parse.controller';
import { ParseService } from '../parse.service';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BadRequestException } from '@nestjs/common';
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

describe('ParseController', () => {
  let controller: ParseController;
  let parseService: jest.Mocked<ParseService>;

  beforeEach(async () => {
    parseService = {
      parseImportJob: jest.fn(),
    } as unknown as jest.Mocked<ParseService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParseController],
      providers: [
        { provide: ParseService, useValue: parseService },
        { provide: AccessTokenGuard, useClass: MockAccessTokenGuard },
        { provide: RolesGuard, useClass: MockRolesGuard },
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: Reflector, useValue: {} },
      ],
    }).compile();

    controller = module.get<ParseController>(ParseController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parse', () => {
    it('should delegate to service with correct arguments', async () => {
      const user = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' };
      parseService.parseImportJob.mockResolvedValue({
        importJobId: 'job-1',
        status: 'PARSED',
        parseSummary: {
          version: 1,
          format: 'CSV',
          success: true,
          sheetCount: 1,
          sheets: [{ name: 'CSV', headerCount: 2, dataRowCount: 1 }],
          totalDataRows: 1,
          maxColumns: 2,
          emptySheetCount: 0,
          formulaCellCount: 0,
          parsedAt: '2024-01-01T00:00:00.000Z',
        },
      });

      const result = await controller.parse(user, 'company-1', 'job-1');

      expect(parseService.parseImportJob).toHaveBeenCalledWith('company-1', 'job-1', 'user-1');
      expect(result.status).toBe('PARSED');
    });

    it('should propagate service errors', async () => {
      const user = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' };
      parseService.parseImportJob.mockRejectedValue(new BadRequestException('Invalid state'));

      await expect(controller.parse(user, 'company-1', 'job-1')).rejects.toThrow(BadRequestException);
    });
  });
});
