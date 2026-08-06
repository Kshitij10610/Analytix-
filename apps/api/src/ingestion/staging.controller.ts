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
import { StageResponseDto } from './dto/stage-response.dto';
import { StagingService } from './staging.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class StagingController {
  constructor(private readonly stagingService: StagingService) {}

  @Post('companies/:companyId/imports/:importJobId/stage')
  @Roles('ANALYST', 'ADMIN')
  async stage(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
  ): Promise<StageResponseDto> {
    const result = await this.stagingService.stageImportJob(companyId, importJobId, user.userId);
    return {
      importJobId: result.importJobId,
      status: result.status,
      stagedRowCount: result.stagedRowCount,
      sheetCount: result.sheetCount,
      mapping: result.mapping as any,
    };
  }
}
