# ADR 002: Backend stack

## Status

Accepted

## Decision

| Component | Choice |
|-----------|--------|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache / queue | Redis 7 + BullMQ |
| Validation | class-validator + Zod at boundaries |
| API style | REST + OpenAPI (Swagger) |

## Rationale

NestJS provides modular structure for booking, availability, notifications. Prisma migrations version schema; PostgreSQL exclusion constraints enforce no overlap at DB level.
