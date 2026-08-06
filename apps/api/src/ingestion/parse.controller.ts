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
import { ParseService } from './parse.service';
import { ParseResponseDto } from './dto/parse-response.dto';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class ParseController {
  constructor(private readonly parseService: ParseService) {}

  @Post('companies/:companyId/imports/:importJobId/parse')
  @Roles('ANALYST', 'ADMIN')
  async parse(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
  ): Promise<ParseResponseDto> {
    return this.parseService.parseImportJob(companyId, importJobId, user.userId);
  }
}
