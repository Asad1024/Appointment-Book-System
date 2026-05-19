import { IsIn, IsString } from 'class-validator';
import { AppointmentStatus } from '@pkg/shared-types';

export class UpdateStatusDto {
  @IsString()
  @IsIn([
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED,
  ])
  status!: string;
}
