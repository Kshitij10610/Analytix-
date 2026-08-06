import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IngestionUploadInterceptor } from './interceptors/ingestion-upload.interceptor';
import { UploadResponseDto } from './dto/upload-response.dto';
import { IngestionService } from './ingestion.service';

export interface IngestionFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
}

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('companies/:companyId/imports/upload')
  @UseInterceptors(IngestionUploadInterceptor)
  @Roles('ANALYST', 'ADMIN')
  async upload(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @UploadedFile() file: IngestionFile,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file');
    }
    return this.ingestionService.upload(companyId, file, file.originalname, user.userId);
  }
}
