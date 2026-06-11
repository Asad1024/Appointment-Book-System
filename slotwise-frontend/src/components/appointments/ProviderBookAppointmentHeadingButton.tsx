'use client';

import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { BookAppointmentSlideOver } from '@/components/appointments/BookAppointmentSlideOver';
import { Button } from '@/components/ui/Button';
import { bookingLinkSourceFromRole } from '@/lib/booking-link-attribution';
import { useProviderSession } from '@/lib/useProviderSession';

export function ProviderBookAppointmentHeadingButton() {
  const [open, setOpen] = useState(false);
  const { user, profile } = useProviderSession({ redirectToLogin: false });
  const canBook = Boolean(profile?.locationId && profile?.location?.timezone);
  const sourceDefault = bookingLinkSourceFromRole(user?.role ?? 'provider');

  return (
    <>
      <Button
        type="button"
        className="bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600"
        onClick={() => setOpen(true)}
        disabled={!canBook}
      >
        <CalendarPlus className="mr-2 h-4 w-4" />
        Book Appointment
      </Button>
      {canBook && profile?.location?.timezone && (
        <BookAppointmentSlideOver
          open={open}
          onOpenChange={setOpen}
          locationId={profile.locationId}
          locationTimezone={profile.location.timezone}
          fixedProviderId={profile.id}
          sourceDefault={sourceDefault}
        />
      )}
    </>
  );
}
