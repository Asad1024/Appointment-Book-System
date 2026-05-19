import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class WaitlistDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsString()
  preferredDate!: string;

  @IsEmail()
  customerEmail!: string;

  @IsString()
  customerName!: string;
}
