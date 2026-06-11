import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ServiceDescriptionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  currentDescription?: string;
}
