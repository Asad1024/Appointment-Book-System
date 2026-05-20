import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsISO8601,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class IntakeResponseItemDto {
  @IsString()
  fieldId!: string;

  @IsString()
  value!: string;
}

export class BookAppointmentDto {
  @IsUUID()
  serviceId!: string;

  @IsString()
  providerId!: string;

  @IsUUID()
  locationId!: string;

  @IsISO8601()
  startUtc!: string;

  @IsString()
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^\+?[\d\s\-()]+$/, {
    message: 'Phone must be a valid number with optional country code (e.g. +971501234567)',
  })
  customerPhone!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  @IsOptional()
  @IsString()
  metadata?: string;

  @IsOptional()
  @IsString()
  customerTimezone?: string;

  @IsOptional()
  @IsString()
  stripePaymentIntentId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntakeResponseItemDto)
  intakeResponses?: IntakeResponseItemDto[];

  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  reminderOffsetsMinutes?: number[];
}
