import { IsUUID } from 'class-validator';

export class UnlinkServiceProviderDto {
  @IsUUID()
  serviceId!: string;

  @IsUUID()
  providerId!: string;
}
