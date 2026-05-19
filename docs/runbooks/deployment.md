# Deployment runbook

## Prerequisites

- Docker and Docker Compose
- Node.js 20+, pnpm 9+
- PostgreSQL 16 and Redis 7 (or use `docker compose up -d`)

## Local development

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

## Production deploy

1. Provision managed PostgreSQL and Redis.
2. Set environment variables (see `.env.example`).
3. Run migrations: `pnpm db:migrate`
4. Build: `pnpm build`
5. Start API: `node apps/api/dist/main`
6. Start web: `pnpm --filter @app/web start`
7. Configure HTTPS reverse proxy (nginx/Caddy) with HSTS.

## Backups

- Enable automated daily PostgreSQL backups (RPO 24h target).
- Test restore quarterly; document RTO (4h target).

## Rollback

1. Revert container/image to previous tag.
2. If migration was destructive, restore DB from last backup.
3. Verify `/health` returns `healthy`.
