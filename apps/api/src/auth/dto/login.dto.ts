import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(255)
  password!: string;
}
