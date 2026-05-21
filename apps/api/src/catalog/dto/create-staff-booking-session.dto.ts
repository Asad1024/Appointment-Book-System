import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateStaffBookingSessionDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  serviceId!: string;

  @IsString()
  providerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  campaign?: string;
}
