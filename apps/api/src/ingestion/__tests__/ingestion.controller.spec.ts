import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from '../ingestion.controller';
import { IngestionService } from '../ingestion.service';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthService } from '../../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IngestionFile } from '../ingestion.controller';
import { IngestionUploadInterceptor } from '../interceptors/ingestion-upload.interceptor';
import { ConfigService } from '@nestjs/config';

class MockAccessTokenGuard {
  canActivate = jest.fn(() => true);
}

class MockRolesGuard {
  canActivate = jest.fn(() => true);
}

describe('IngestionController', () => {
  let controller: IngestionController;
  let ingestionService: jest.Mocked<IngestionService>;

  beforeEach(async () => {
    ingestionService = {
      upload: jest.fn(),
    } as unknown as jest.Mocked<IngestionService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        { provide: IngestionService, useValue: ingestionService },
        { provide: AccessTokenGuard, useClass: MockAccessTokenGuard },
        { provide: RolesGuard, useClass: MockRolesGuard },
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(10 * 1024 * 1024) } },
        { provide: IngestionUploadInterceptor, useValue: { intercept: jest.fn() } },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    const companyId = 'company-1';
    const user = { userId: 'user-1', email: 'test@test.com', role: 'OWNER' };
    const mockFile = {
      buffer: Buffer.from('a,b\n1,2'),
      size: 6,
      originalname: 'test.csv',
      mimetype: 'text/csv',
    } as IngestionFile;

    it('should return 400 when file is missing', async () => {
      ingestionService.upload.mockRejectedValueOnce(new BadRequestException('Missing file'));
      await expect(controller.upload(user, companyId, null as any)).rejects.toThrow(BadRequestException);
    });

    it('should delegate to service with correct arguments', async () => {
      ingestionService.upload.mockResolvedValue({
        importJobId: 'job-1',
        sourceFileId: 'source-1',
        status: 'UPLOADED',
        statementType: null,
        originalFilename: 'test.csv',
        mimeType: 'text/csv',
        sizeBytes: 6,
        sha256: 'abc123',
        uploadedAt: new Date(),
      });

      const result = await controller.upload(user, companyId, mockFile);
      expect(ingestionService.upload).toHaveBeenCalledWith(companyId, mockFile, 'test.csv', 'user-1');
      expect(result.importJobId).toBe('job-1');
      expect(result.status).toBe('UPLOADED');
    });

    it('should propagate service errors', async () => {
      ingestionService.upload.mockRejectedValueOnce(new ForbiddenException('Insufficient permissions'));
      await expect(controller.upload(user, companyId, mockFile)).rejects.toThrow(ForbiddenException);
    });

    it('should return safe response without storageKey or actor fields', async () => {
      ingestionService.upload.mockResolvedValue({
        importJobId: 'job-1',
        sourceFileId: 'source-1',
        status: 'UPLOADED',
        statementType: null,
        originalFilename: 'test.csv',
        mimeType: 'text/csv',
        sizeBytes: 6,
        sha256: 'abc123',
        uploadedAt: new Date(),
      });

      const result = await controller.upload(user, companyId, mockFile);
      expect(result).not.toHaveProperty('storageKey');
      expect(result).not.toHaveProperty('uploadedBy');
      expect(result).not.toHaveProperty('createdBy');
    });
  });
});
