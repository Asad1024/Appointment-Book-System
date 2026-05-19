import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntakeValidationService } from './intake-validation.service';

@Module({
  imports: [PrismaModule],
  providers: [IntakeValidationService],
  exports: [IntakeValidationService],
})
export class IntakeValidationModule {}
