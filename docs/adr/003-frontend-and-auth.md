# ADR 003: Frontend and authentication

## Status

Accepted

## Decision

| Component | Choice |
|-----------|--------|
| Frontend | Next.js 14 App Router, React 18, Tailwind CSS |
| Staff auth | JWT (access + refresh) issued by API; httpOnly cookie optional later |
| Customer access | Guest booking + signed magic links for manage flow |
| Admin | Routes under `/admin/*` protected by middleware |

Phase 2/3: OIDC/Entra ID via passport strategy extension point.
