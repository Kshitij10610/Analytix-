import { IsString, IsEmail, MinLength, IsIn } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @IsEmail()
  @MinLength(1)
  email!: string;

  @IsString()
  @IsIn(['EDITOR', 'VIEWER'])
  role!: string;
}
