import {
  Controller,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NormalizationResponseDto } from './dto/normalization-response.dto';
import { NormalizationService } from './normalization.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class NormalizationController {
  constructor(private readonly normalizationService: NormalizationService) {}

  @Post('companies/:companyId/imports/:importJobId/normalize')
  @Roles('ANALYST', 'ADMIN')
  async normalize(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
  ): Promise<NormalizationResponseDto> {
    return this.normalizationService.normalizeImportJob(
      companyId,
      importJobId,
      user.userId,
    );
  }
}
