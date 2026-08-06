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
import { AddMemberDto } from './dto/add-member.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CompanyMembersService } from './company-members.service';

@Controller('companies/:companyId/members')
@UseGuards(AccessTokenGuard, RolesGuard)
export class CompanyMembersController {
  constructor(private readonly companyMembersService: CompanyMembersService) {}

  @Get()
  @Roles('USER', 'ANALYST', 'ADMIN')
  async listMembers(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
  ) {
    return this.companyMembersService.listMembers(user.userId, user.role, companyId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async addMember(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.companyMembersService.addMember(user.userId, user.role, companyId, dto, user.email);
  }

  @Patch(':memberId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async updateMemberRole(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.companyMembersService.updateMemberRole(user.userId, user.role, companyId, memberId, dto, user.email);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ANALYST', 'ADMIN')
  async removeMember(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.companyMembersService.removeMember(user.userId, user.role, companyId, memberId, user.email);
  }

  @Post(':memberId/transfer-ownership')
  @Roles('ANALYST', 'ADMIN')
  async transferOwnership(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.companyMembersService.transferOwnership(user.userId, user.role, companyId, dto, user.email);
  }

  @Delete('self/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ANALYST', 'ADMIN')
  async leaveCompany(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
  ) {
    await this.companyMembersService.removeSelf(user.userId, companyId, user.email);
  }
}
