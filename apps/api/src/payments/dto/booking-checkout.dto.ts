import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BookingCheckoutDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  serviceId!: string;

  @IsString()
  providerId!: string;

  @IsISO8601()
  startUtc!: string;

  @IsString()
  @MinLength(2)
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^\+?[\d\s\-()]+$/)
  customerPhone!: string;

  @IsOptional()
  @IsString()
  customerTimezone?: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsString()
  campaign?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  org?: string;

  @IsOptional()
  @IsString()
  intakeResponses?: string;
}
