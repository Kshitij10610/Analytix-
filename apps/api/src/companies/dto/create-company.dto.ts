import { IsString, MinLength, IsOptional, IsUrl } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsUrl({ require_tld: false })
  @IsOptional()
  website?: string;
}
