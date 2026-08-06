import {
  Controller,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MappingConfirmRequestDto, MappingConfirmResponseDto } from './dto/mapping.dto';
import { MappingService } from './mapping.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class MappingController {
  constructor(private readonly mappingService: MappingService) {}

  @Put('companies/:companyId/imports/:importJobId/mapping')
  @Roles('ANALYST', 'ADMIN')
  async confirmMapping(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
    @Body() body: MappingConfirmRequestDto,
  ): Promise<MappingConfirmResponseDto> {
    const result = await this.mappingService.confirmMapping(companyId, importJobId, user.userId, {
      statementType: body.statementType,
      sheets: body.sheets,
    });
    return {
      importJobId: result.importJobId,
      status: result.status,
      mapping: result.mapping,
    };
  }
}
