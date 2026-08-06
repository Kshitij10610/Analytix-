import { IsString, IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
