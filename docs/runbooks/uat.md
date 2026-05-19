# UAT checklist (1–2 weeks in staging)

## Booking flow

- [ ] Book as guest with valid email
- [ ] Receive confirmation (email or dev console log)
- [ ] Download .ics from manage page
- [ ] Reschedule within policy
- [ ] Cancel within policy
- [ ] Verify cannot cancel inside cutoff window

## Admin

- [ ] Login as org_admin
- [ ] View weekly schedule
- [ ] Create manual booking via API or future UI
- [ ] Export appointments

## Concurrency

- [ ] Run `pnpm --filter @app/api test:concurrency` — exactly 1 success of 50 parallel attempts

## Security

- [ ] Public endpoints rate-limited (429 after threshold)
- [ ] Admin routes reject unauthenticated requests
- [ ] Provider role cannot access org_admin-only routes

## Sign-off

Product owner and operations lead sign off before production cutover.
