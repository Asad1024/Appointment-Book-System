import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { AvailabilityModule } from './availability/availability.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IntegrationModule } from './integration/integration.module';
import { PartnerModule } from './partner/partner.module';
import { TeamModule } from './team/team.module';
import { SettingsModule } from './settings/settings.module';
import { BillingModule } from './billing/billing.module';
import { PaymentsModule } from './payments/payments.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CsrfMiddleware } from './auth/csrf.middleware';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';

const syncNotifications = process.env.USE_SYNC_NOTIFICATIONS === 'true';

// apps/api/.env first, then repo root — later files override (root wins for shared keys)
const envFiles = [
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '..', '.env'),
].filter(existsSync);

const infrastructureImports = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: envFiles.length > 0 ? envFiles : undefined,
  }),
  ScheduleModule.forRoot(),
  ThrottlerModule.forRoot([
    { name: 'short', ttl: 1000, limit: 10 },
    { name: 'medium', ttl: 60000, limit: 100 },
  ]),
  ...(syncNotifications
    ? []
    : [
        BullModule.forRoot({
          connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
        }),
      ]),
];

@Module({
  imports: [
    ...infrastructureImports,
    PrismaModule,
    AuthModule,
    CatalogModule,
    AvailabilityModule,
    AppointmentsModule,
    NotificationsModule.forRoot(),
    ReportsModule,
    HealthModule,
    IntegrationsModule,
    IntegrationModule,
    PartnerModule,
    TeamModule,
    SettingsModule,
    BillingModule,
    PaymentsModule,
    RealtimeModule,
    ReviewsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
