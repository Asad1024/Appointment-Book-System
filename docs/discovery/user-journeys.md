# User Journeys

## 1. Customer books appointment (happy path)

1. Opens public booking page (`/book`)
2. Selects service (e.g. "Consultation — 30 min")
3. Optionally selects provider or "Any available"
4. Picks date and available time slot (timezone shown for location)
5. Enters name, email, phone
6. Confirms → receives confirmation screen + email with manage link
7. Can download `.ics` calendar file

## 2. Customer reschedules

1. Opens magic link from email (`/manage/[token]`)
2. Views appointment details
3. Chooses new slot (if within reschedule policy)
4. Receives updated confirmation email

## 3. Customer cancels

1. Opens manage link
2. Cancels (if before cancellation cutoff)
3. Receives cancellation email

## 4. Admin creates manual booking

1. Logs into admin (`/admin`)
2. Opens calendar or "New booking"
3. Selects provider, service, slot, enters customer details
4. Booking created with `source: admin` in audit trail

## 5. Provider views schedule

1. Logs in with provider role
2. Sees own appointments for day/week
3. Cannot edit org-wide catalog (admin only)

## 6. System sends reminder

1. Cron/queue job finds appointments starting in ~24h
2. Enqueues reminder email
3. Worker sends email; logs delivery status
