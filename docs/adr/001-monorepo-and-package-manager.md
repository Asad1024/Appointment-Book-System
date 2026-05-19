# ADR 001: Monorepo and package manager

## Status

Accepted

## Context

Multiple deployable apps (API, web) and shared libraries (scheduling-core, types) need coordinated versioning.

## Decision

Use **pnpm workspaces** monorepo:

- `apps/api` — NestJS REST API
- `apps/web` — Next.js 14 (App Router) public booking + admin
- `packages/scheduling-core` — pure slot logic
- `packages/shared-types` — shared TypeScript types

## Consequences

- Single `pnpm install` at root
- Workspace protocol for internal deps (`workspace:*`)
