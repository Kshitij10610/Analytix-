import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionUploadInterceptor } from './interceptors/ingestion-upload.interceptor';
import { MappingController } from './mapping.controller';
import { MappingService } from './mapping.service';
import { NormalizationController } from './normalization.controller';
import { NormalizationService } from './normalization.service';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';
import { StagingController } from './staging.controller';
import { StagingService } from './staging.service';
import { StatementMetadataController } from './statement-metadata.controller';
import { StatementMetadataService } from './statement-metadata.service';
import { LocalFileStorageService } from './storage/local-file-storage.service';
import { TrustedCommitController } from './trusted-commit.controller';
import { TrustedCommitService } from './trusted-commit.service';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [ConfigModule, AuthModule, AuthorizationModule, AuditModule],
  controllers: [
    IngestionController,
    ParseController,
    StagingController,
    MappingController,
    ValidationController,
    NormalizationController,
    StatementMetadataController,
    TrustedCommitController,
  ],
  providers: [
    IngestionService,
    LocalFileStorageService,
    IngestionUploadInterceptor,
    ParseService,
    StagingService,
    MappingService,
    ValidationService,
    NormalizationService,
    StatementMetadataService,
    TrustedCommitService,
  ],
  exports: [
    IngestionService,
    ParseService,
    StagingService,
    MappingService,
    ValidationService,
    NormalizationService,
    StatementMetadataService,
    TrustedCommitService,
  ],
})
export class IngestionModule {}

