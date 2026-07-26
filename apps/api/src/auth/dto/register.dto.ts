import { IsEmail, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(255)
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string | null;
}
