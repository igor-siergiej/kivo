# Kivo - Authentication Service

JWT auth service for the shoppingo / jewellery-catalogue apps. Bun + Hono + MongoDB, deployed to Dokploy (`kivo.imapps.uk`, internal `kivo-api-1pae1e:3008`).

## Commands (Bun, not yarn/npm)
- `bun start` - dev server with hot reload (port 3008, needs MongoDB and `.env` from `.env.example`)
- `bun test` - unit tests (`tests/*.test.ts`, in-memory fakes in `tests/helpers`)
- `bun run lint` / `bun run lint:fix` - Biome
- `bun run typecheck` - `tsc --noEmit` over `src` and `tests`
- `bun run build` - single self-contained bundle in `build/` (nothing external)
- e2e: `bash scripts/e2e.sh` against a running server (`E2E_BASE_URL`, default `http://localhost:3008`); `kanban-cli e2e local .` starts Mongo via `docker-compose.test.yml` on 27018 and runs it

## Layout
```
src/index.ts            app wiring: middleware order, routes, shutdown
src/routes/*            login, register, refresh, verify, logout (+ /logout-all), search, users
src/lib/auth/           token issuing/verifying, sessions, refresh cookie; password.ts = argon2id
src/lib/config/         env schema (typed AppConfig); durations parsed by lib/utils/duration
src/lib/validation.ts   body parsing + field validation (throws APIError 400)
src/lib/rateLimiter.ts  bounded fixed-window limiter used by the global and search limits
src/middleware/         rateLimit, loginThrottle, lookupAuth, internalOnly, security headers
src/lib/database/       index setup (users unique+collation, sessions tokenHash/username/TTL)
```

## Auth model
- Access token (`tokenType: 'access'`, short) and refresh token (`tokenType: 'refresh'`, has `jti`), HS256, `aud`/`iss` = `kivo`. `/verify` only accepts access tokens.
- Refresh tokens are stored hashed (sha256) in `sessions` with a `familyId`. Refresh rotates: the old session gets `rotatedAt`; replaying it after a 10s grace revokes the whole family. Max 10 active sessions per user.
- Cookie: `__Host-refreshToken` when `SECURE=true` (legacy `refreshToken` still read), lifetime = `REFRESH_TOKEN_EXPIRY`; sessions TTL index uses the same value.
- Passwords: argon2id via `Bun.password`; legacy bcrypt hashes verify and are upgraded on login. Usernames are case-insensitive (collation `en`, strength 2).
- Failed logins: 5 per username per 15 min locks it (in-memory). Global rate limit: 55/min per IP, 300/min per verified user id. Client IP = `cf-connecting-ip`, else last `x-forwarded-for` hop.

## Environment
`PORT, CONNECTION_URI, DATABASE_NAME, JWT_SECRET (>= 32 chars), ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, SECURE, SAME_SITE (Strict|Lax|None), CORS_ALLOWED_ORIGINS`, optional `LOOKUP_AUTH_ENABLED` + `SERVICE_TOKEN` (gate `/users`/`/search`; off until consumers send credentials). Never commit `.env`.

## Endpoints
`POST /login /register /refresh /logout /logout-all /users`, `GET /verify /search /health /ready /metrics`. `/metrics` is hidden from Cloudflare-proxied traffic (404); Prometheus scrapes it in-cluster.

## Delivery
- PR to `main` runs `PR Checks` (lint, typecheck, test); merge triggers `CI/CD` (semantic-release, Docker image, Dokploy deploy). Use conventional commits.
- Docker: multi-stage, runner has only `build/`, runs as `bun`, healthcheck on `/health`. The registry token is only in the builder stage.
- Gotchas: a unique index on existing prod data can crash-loop startup (happened once with `sessions.tokenHash`); keep index builds non-fatal or check data first.
- Work board: `kanban/kivo.board.md` in the notes dir (kanban-worker skill); `.kanban-cli.json` configures local e2e + live smoke on `https://kivo.imapps.uk`.
