import {
  Controller,
  Put,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StatementMetadataDto, StatementMetadataResponse } from './dto/statement-metadata.dto';
import { StatementMetadataService } from './statement-metadata.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class StatementMetadataController {
  constructor(private readonly statementMetadataService: StatementMetadataService) {}

  @Put('companies/:companyId/imports/:importJobId/statement-metadata')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async finalize(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
    @Body() dto: StatementMetadataDto,
  ): Promise<StatementMetadataResponse> {
    return this.statementMetadataService.finalizeStatementMetadata(
      companyId,
      importJobId,
      dto,
      user.userId,
    );
  }
}
