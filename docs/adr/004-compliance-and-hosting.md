# ADR 004: Compliance and hosting

## Status

Accepted

## Decision

- **Compliance tier (MVP):** General B2B — audit logs, soft delete, export endpoint stub
- **Hosting target:** Docker containers on Azure/AWS; local dev via Docker Compose
- **Secrets:** environment variables; `.env.example` only in repo
- **HIPAA:** Not in MVP; if required, add BAA vendors, field encryption, and separate ADR

## Observability (Phase 2)

Structured JSON logs, health endpoints, Prometheus metrics hook on API.
