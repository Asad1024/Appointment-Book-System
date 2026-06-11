import { Controller, MessageEvent, Req, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RealtimeService } from './realtime.service';

@ApiTags('realtime')
@ApiBearerAuth()
@Controller('realtime')
@UseGuards(JwtAuthGuard)
export class RealtimeController {
  constructor(private realtime: RealtimeService) {}

  @Sse('events')
  events(@Req() req: { user: { orgId: string } }): Observable<MessageEvent> {
    const orgId = req.user.orgId;
    const heartbeat = interval(25_000).pipe(
      map(
        (): MessageEvent => ({
          data: JSON.stringify({ type: 'ping', at: new Date().toISOString() }),
        }),
      ),
    );
    return merge(heartbeat, this.realtime.stream(orgId));
  }
}
