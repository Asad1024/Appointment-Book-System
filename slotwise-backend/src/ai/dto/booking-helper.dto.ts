import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class BookingHelperDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  query!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  org!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customerTimezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  today?: string;
}
