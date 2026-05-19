import { UserRole } from '@pkg/shared-types';
import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  providerId?: string;
}
