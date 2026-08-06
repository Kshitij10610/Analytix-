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
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(AccessTokenGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findAll(@CurrentUser() user: { userId: string; email: string; role: string }) {
    return this.companiesService.findAll(user.userId, user.role);
  }

  @Get(':id')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findOne(@CurrentUser() user: { userId: string; email: string; role: string }, @Param('id') id: string) {
    return this.companiesService.findOne(user.userId, user.role, id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async create(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Body() createCompanyDto: CreateCompanyDto,
  ) {
    return this.companiesService.create(createCompanyDto, user.userId, user.email, user.role);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async update(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(user.userId, user.role, id, updateCompanyDto, user.email);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  async remove(@CurrentUser() user: { userId: string; email: string; role: string }, @Param('id') id: string) {
    await this.companiesService.remove(user.userId, user.role, id, user.email);
  }
}
