import { IsArray, IsUUID } from 'class-validator';

export class SyncProviderServicesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds!: string[];
}
