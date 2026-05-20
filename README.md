# Appointment Booking System

Production-grade, company-owned appointment booking platform.

## Features

- Public booking wizard (service → provider → slot → details)
- **Product integration** — `?product=`, embed iframe, webhooks, return URLs ([guide](docs/INTEGRATION.md))
- **Customer accounts** — register, sign in, view appointments at `/account`
- Overlap protection in application layer (MySQL row locking)
- Admin dashboard and staff JWT auth
- Email confirmations (console in dev without SMTP)
- Magic-link appointment management (cancel / reschedule)
- Rate limiting, RBAC, health checks

## Quick start (local MySQL + Memurai)

Uses **MySQL 8** and **Memurai** (or Redis) on your machine.

1. Copy `.env.example` → `.env` and set `DATABASE_URL` (see below).
2. Create the database: `CREATE DATABASE appointments;`
3. Run:

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

**MySQL connection string:**

```env
DATABASE_URL=mysql://root:YOUR_PASSWORD@localhost:3306/appointments
```

## Optional: Docker (MySQL + Redis)

```bash
cp .env.example .env
# DATABASE_URL=mysql://root:appointments@localhost:3306/appointments
docker compose up -d
pnpm install && pnpm db:push && pnpm db:seed
pnpm dev
```

| URL | Description |
|-----|-------------|
| http://localhost:3002 | Public web + admin |
| http://localhost:3003/api/docs | Swagger API |
| admin@demo.com / admin123 | Demo admin login |

## Project structure

```
apps/api          NestJS REST API + Prisma
apps/web          Next.js booking + admin UI
packages/scheduling-core   Slot generation (Luxon)
packages/shared-types      Shared enums/types
docs/             Discovery, ADRs, runbooks, OpenAPI
infrastructure/   Dockerfiles
```

## Integration examples

```
http://localhost:3002/book?product=demo&source=my-app&returnUrl=https://example.com/thanks
http://localhost:3002/book/john-smith/product-demo?org=demo-company
http://localhost:3002/book/event?org=demo-company&serviceId=11111111-1111-4111-8111-111111111102&providerId=11111111-1111-4111-8111-111111111201
http://localhost:3002/embed/book?product=demo&source=footer
```

## Documentation

- [Product integration](docs/INTEGRATION.md)
- [MVP scope](docs/discovery/mvp-scope.md)
- [User journeys](docs/discovery/user-journeys.md)
- [Deployment runbook](docs/runbooks/deployment.md)
- [Support runbook](docs/runbooks/support.md)
- [ADRs](docs/adr/)

## Tests

```bash
pnpm --filter @pkg/scheduling-core test:run
pnpm --filter @app/api test:concurrency   # requires DB
```

## License

Proprietary — your company.
