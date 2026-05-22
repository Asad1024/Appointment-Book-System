import { UserRole } from '@pkg/shared-types';
import { IsEmail, IsEnum } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
