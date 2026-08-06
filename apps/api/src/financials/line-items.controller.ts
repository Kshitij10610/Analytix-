import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { ReplaceLineItemsDto } from './dto/replace-line-items.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import { LineItemsService } from './line-items.service';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class LineItemsController {
  constructor(private readonly lineItemsService: LineItemsService) {}

  @Get('financial-statements/:statementId/line-items')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findByStatement(@CurrentUser() user: { userId: string; email: string; role: string }, @Param('statementId') statementId: string) {
    return this.lineItemsService.findByStatement(statementId, user.userId, user.role);
  }

  @Post('financial-statements/:statementId/line-items')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async createForStatement(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('statementId') statementId: string,
    @Body() dto: CreateLineItemDto,
  ) {
    return this.lineItemsService.create(statementId, dto.metricCode, {
      value: dto.value,
      labelOverride: dto.labelOverride,
      displayOrder: dto.displayOrder,
    }, user.userId, user.role, user.email);
  }

  @Put('financial-statements/:statementId/line-items')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async replaceForStatement(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('statementId') statementId: string,
    @Body() dto: ReplaceLineItemsDto,
  ) {
    return this.lineItemsService.replaceLineItems(statementId, dto.lineItems, user.userId, user.role, user.email);
  }

  @Patch('financial-line-items/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async update(@CurrentUser() user: { userId: string; email: string; role: string }, @Param('id') id: string, @Body() dto: UpdateLineItemDto) {
    const data: Record<string, unknown> = {};
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.labelOverride !== undefined) data.labelOverride = dto.labelOverride;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    return this.lineItemsService.update(id, data, user.userId, user.role, user.email);
  }

  @Delete('financial-line-items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  async remove(@CurrentUser() user: { userId: string; email: string; role: string }, @Param('id') id: string) {
    await this.lineItemsService.remove(id, user.userId, user.role, user.email);
  }
}
