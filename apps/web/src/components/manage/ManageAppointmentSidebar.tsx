'use client';

import Link from 'next/link';
import { CalendarPlus, HelpCircle, Phone } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ManageAppointment } from '@/app/manage/[token]/types';

type Props = {
  appt: ManageAppointment;
  onReschedule: () => void;
  onAddToGoogle: () => void;
  onDownloadIcs: () => void;
  canModify: boolean;
  canChangeTime: boolean;
  reschedulesLeft: number;
};

export function ManageAppointmentSidebar({
  appt,
  onReschedule,
  onAddToGoogle,
  onDownloadIcs,
  canModify,
  canChangeTime,
  reschedulesLeft,
}: Props) {
  return (
    <aside className="space-y-4">
      <Card>
        <CardBody className="space-y-4 !p-8 sm:!p-10">
          <h3 className="text-sm font-semibold text-text-primary">Quick actions</h3>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={onAddToGoogle}>
            <CalendarPlus className="h-4 w-4" />
            Add to Google Calendar
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={onDownloadIcs}>
            <CalendarPlus className="h-4 w-4" />
            Download .ics (Outlook / Apple)
          </Button>
          {canChangeTime && reschedulesLeft > 0 && (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={onReschedule}>
              <CalendarPlus className="h-4 w-4" />
              Reschedule
            </Button>
          )}
          <Link href="/book" className="block">
            <Button variant="ghost" className="w-full justify-start gap-2">
              Book another appointment
            </Button>
          </Link>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4 !p-8 text-sm sm:!p-10">
          <h3 className="flex items-center gap-2 font-semibold text-text-primary">
            <HelpCircle className="h-4 w-4 text-brand-600" />
            Policies
          </h3>
          <ul className="space-y-2 text-text-secondary">
            <li>
              You can reschedule up to <strong className="text-text-primary">3 times</strong> per
              booking ({Math.max(0, 3 - appt.rescheduleCount)} left).
            </li>
            {appt.location.cancellationCutoffH > 0 && (
              <li>
                Changes must be made at least{' '}
                <strong className="text-text-primary">{appt.location.cancellationCutoffH} hours</strong>{' '}
                before your appointment.
              </li>
            )}
          </ul>
        </CardBody>
      </Card>

      {(appt.location.address || appt.location.phone) && (
        <Card>
          <CardBody className="space-y-3 !p-8 text-sm sm:!p-10">
            <h3 className="font-semibold text-text-primary">Location contact</h3>
            {appt.location.address && (
              <p className="text-text-secondary">{appt.location.address}</p>
            )}
            {appt.location.phone && (
              <p className="flex items-center gap-2 text-text-secondary">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${appt.location.phone}`} className="hover:text-brand-600">
                  {appt.location.phone}
                </a>
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </aside>
  );
}
