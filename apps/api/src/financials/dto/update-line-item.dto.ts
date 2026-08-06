import { IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateLineItemDto {
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,6})?$/)
  value?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  labelOverride?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
