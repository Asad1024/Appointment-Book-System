import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @Length(2, 80)
  cardholderName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'Enter a valid card number' })
  cardNumber!: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'Expiry must be MM/YY' })
  expiry!: string;

  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'Enter a valid CVC' })
  cvc!: string;

  @IsOptional()
  @IsString()
  billingEmail?: string;
}
