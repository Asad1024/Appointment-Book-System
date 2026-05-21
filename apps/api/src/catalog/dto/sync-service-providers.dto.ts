import { IsArray, IsUUID } from 'class-validator';

export class SyncServiceProvidersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  providerIds!: string[];
}
