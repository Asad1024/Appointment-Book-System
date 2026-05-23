import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const LOGIN_CONTEXTS = ['customer', 'provider', 'admin', 'super_admin'] as const;
type LoginContext = (typeof LOGIN_CONTEXTS)[number];

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn(LOGIN_CONTEXTS)
  expectedRole?: LoginContext;
}
