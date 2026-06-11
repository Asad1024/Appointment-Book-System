import { IsEmail, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class WaitlistDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsString()
  preferredDate!: string;

  @IsOptional()
  @IsISO8601()
  preferredStartUtc?: string;

  @IsEmail()
  customerEmail!: string;

  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;
}

export class WaitlistLeaveDto {
  @IsEmail()
  customerEmail!: string;
}
