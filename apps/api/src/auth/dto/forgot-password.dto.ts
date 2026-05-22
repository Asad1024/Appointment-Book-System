import { IsEmail, IsIn, IsOptional, Matches } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['customer', 'provider', 'admin', 'super_admin'])
  role?: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  org?: string;
}
