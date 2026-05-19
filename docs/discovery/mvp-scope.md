# MVP Scope — Appointment Booking System

## Product goal

Company-owned appointment platform: customers book online; staff manage availability and schedules; zero double-booking with audit trail.

## MVP boundaries (Phase 1)

### In scope

- Single organization (multi-tenant deferred to Phase 3)
- One or more locations, providers, and services
- Public booking flow: service → provider (optional) → date/time → details → confirm
- Guest booking (name, email, phone) without mandatory account
- Admin portal: CRUD for catalog, availability, manual booking override
- Availability engine: working hours, blocked time, buffers, lead time, booking window
- Book / cancel / reschedule with policy enforcement
- Email confirmations and 24h reminder (async queue)
- JWT auth for staff (admin, provider roles)
- PostgreSQL with exclusion constraint preventing double-booking
- Basic audit log for appointment status changes
- Docker Compose for local dev (PostgreSQL, Redis)

### Out of scope (later phases)

- Payments / Stripe
- SMS (Phase 2 scaffold only)
- Google/Microsoft calendar sync (Phase 2 scaffold)
- SSO / Entra ID (Phase 3)
- Waitlist, recurring appointments, multi-tenant franchises
- Mobile native apps (responsive web only)

## Success criteria

- 100 test bookings with zero double-books under concurrent load test
- Email confirmation and reminder delivered (or logged in dev)
- Admin can view today's schedule and override bookings
- All times stored UTC; displayed in location timezone

## Stakeholders (template)

| Role | Needs |
|------|-------|
| Product owner | Define services, policies, reports |
| Operations / reception | Manual booking, daily schedule view |
| Providers | Set availability, view appointments |
| Customers | Self-service book, reschedule, cancel |
| Engineering | API, monitoring, deployments |
| Compliance | Data minimization, audit, export (general B2B tier) |

## Compliance tier

**General B2B** — GDPR-style data export/delete hooks, audit logs, no PHI in MVP seed data. Healthcare (HIPAA) extensions documented in ADR-004.
