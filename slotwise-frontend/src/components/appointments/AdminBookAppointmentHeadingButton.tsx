'use client';

import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { BookAppointmentSlideOver } from '@/components/appointments/BookAppointmentSlideOver';
import { Button } from '@/components/ui/Button';
import { useAdminLocation } from '@/lib/admin-location-context';
import { bookingLinkSourceFromRole } from '@/lib/booking-link-attribution';
import { useStaffSession } from '@/lib/useStaffSession';

type AdminBookAppointmentHeadingButtonProps = {
  tone?: 'outline' | 'primary';
};

export function AdminBookAppointmentHeadingButton({
  tone = 'outline',
}: AdminBookAppointmentHeadingButtonProps) {
  const [open, setOpen] = useState(false);
  const { user } = useStaffSession({ redirectToLogin: false });
  const { locationId, location } = useAdminLocation();
  const canBook = Boolean(locationId && location?.timezone);
  const sourceDefault = bookingLinkSourceFromRole(user?.role ?? 'admin');

  return (
    <>
      <Button
        type="button"
        variant={tone === 'primary' ? 'default' : 'outline'}
        className={
          tone === 'outline'
            ? 'border-brand-500 bg-white text-brand-700 hover:bg-brand-50 dark:border-brand-500 dark:bg-slate-950 dark:text-brand-200 dark:hover:bg-brand-950/35'
            : undefined
        }
        onClick={() => setOpen(true)}
        disabled={!canBook}
      >
        <CalendarPlus className="mr-2 h-4 w-4" />
        Book Appointment
      </Button>
      {canBook && location?.timezone && (
        <BookAppointmentSlideOver
          open={open}
          onOpenChange={setOpen}
          locationId={locationId}
          locationTimezone={location.timezone}
          sourceDefault={sourceDefault}
        />
      )}
    </>
  );
}
