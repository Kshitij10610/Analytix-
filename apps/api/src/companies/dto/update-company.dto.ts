import { IsString, MinLength, IsOptional, IsUrl } from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsUrl({ require_tld: false })
  @IsOptional()
  website?: string;
}
