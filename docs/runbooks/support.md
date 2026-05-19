# Support runbook

## Customer cannot book a slot

1. Check provider availability rules in admin.
2. Verify no blocked time overlaps the slot.
3. Confirm lead time and booking window on location settings.
4. Check API logs for `ConflictException` (slot taken).

## Customer cannot cancel

1. Verify cancellation cutoff (`cancellationCutoffH` on location).
2. Use admin manual cancel if policy exception approved (log in audit).

## Duplicate bookings reported

1. Check `appointments_provider_no_overlap` exclusion constraint exists.
2. Run concurrency test: `pnpm --filter @app/api test:concurrency`
3. Review idempotency keys on client retries.

## Email not received

1. Check `notification_logs` table for status `failed`.
2. Verify SMTP env vars; dev mode logs to console without SMTP.
3. Retry by re-queuing notification job in Redis/BullMQ.

## Stuck appointment status

1. Query `appointment_events` for history.
2. Admin can update status via API (org_admin role).

## Data export request (GDPR)

1. Authenticated admin: `GET /appointments/admin/export`
2. Deliver CSV/JSON to requester within policy SLA.
