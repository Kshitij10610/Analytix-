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
import { TrustedCommitService, CommitResponse } from './trusted-commit.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class TrustedCommitController {
  constructor(private readonly trustedCommitService: TrustedCommitService) {}

  @Post('companies/:companyId/imports/:importJobId/commit')
  @Roles('ANALYST', 'ADMIN')
  async commit(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
  ): Promise<CommitResponse> {
    return this.trustedCommitService.commitImportJob(
      companyId,
      importJobId,
      user.userId,
    );
  }
}
