import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type RealtimeEvent = {
  type:
    | 'appointment.created'
    | 'appointment.updated'
    | 'appointment.cancelled'
    | 'waitlist.updated'
    | 'ping';
  appointmentId?: string;
  organizationId?: string;
};

@Injectable()
export class RealtimeService {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  private subjectFor(orgId: string): Subject<MessageEvent> {
    let subject = this.streams.get(orgId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(orgId, subject);
    }
    return subject;
  }

  emit(orgId: string, event: RealtimeEvent) {
    this.subjectFor(orgId).next({
      data: JSON.stringify({ ...event, organizationId: orgId, at: new Date().toISOString() }),
    });
  }

  stream(orgId: string): Observable<MessageEvent> {
    return this.subjectFor(orgId).asObservable();
  }
}
