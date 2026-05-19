import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return {
      status: db === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database: db },
    };
  }

  @Public()
  @Get('metrics')
  metrics() {
    return {
      bookings_total: 'see_reports_endpoint',
      uptime_seconds: process.uptime(),
    };
  }
}
