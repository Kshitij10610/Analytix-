import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateLineItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  metricCode!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d{1,6})?$/)
  value!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  labelOverride?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
