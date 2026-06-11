import { IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsUUID()
  serviceId!: string;

  @IsUUID()
  locationId!: string;
}
