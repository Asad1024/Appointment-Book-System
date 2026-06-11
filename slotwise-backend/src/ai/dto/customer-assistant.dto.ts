import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerAssistantMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(1000)
  content!: string;
}

export class CustomerAssistantStateDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  selectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  startUtc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customerTimezone?: string;

  @IsOptional()
  @IsBoolean()
  hasCustomerDetails?: boolean;
}

export class CustomerAssistantDto {
  @IsString()
  @MaxLength(120)
  org!: string;

  @IsString()
  @MaxLength(120)
  page!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  step?: string;

  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAssistantStateDto)
  state?: CustomerAssistantStateDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerAssistantMessageDto)
  messages?: CustomerAssistantMessageDto[];

  @IsOptional()
  @IsObject()
  accountContext?: Record<string, unknown>;
}

export class CustomerAssistantHistoryQueryDto {
  @IsString()
  @MaxLength(120)
  org!: string;

  @IsString()
  @MaxLength(120)
  page!: string;
}

export class SaveCustomerAssistantHistoryDto extends CustomerAssistantHistoryQueryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerAssistantMessageDto)
  messages!: CustomerAssistantMessageDto[];
}
