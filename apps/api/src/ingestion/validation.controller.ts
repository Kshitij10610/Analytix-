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
import { ValidationResponseDto } from './dto/validation-response.dto';
import { ValidationService } from './validation.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post('companies/:companyId/imports/:importJobId/validate')
  @Roles('ANALYST', 'ADMIN')
  async validate(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('importJobId') importJobId: string,
  ): Promise<ValidationResponseDto> {
    const result = await this.validationService.validateImportJob(
      companyId,
      importJobId,
      user.userId,
    );
    return {
      importJobId: result.importJobId,
      status: result.status,
      valid: result.valid,
      totalErrorCount: result.totalErrorCount,
      truncated: result.truncated,
      errors: result.errors,
      statementType: result.statementType,
    };
  }
}
