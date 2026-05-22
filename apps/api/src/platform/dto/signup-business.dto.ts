import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupBusinessDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  @MinLength(2)
  adminName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
