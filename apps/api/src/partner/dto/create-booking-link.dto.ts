import { IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CreatePartnerBookingLinkDto {
  @IsUUID()
  serviceId!: string;

  @IsUUID()
  providerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  campaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ref?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;
}
