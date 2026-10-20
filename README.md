# kivo

[![CI/CD](https://github.com/igor-siergiej/kivo/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/igor-siergiej/kivo/actions/workflows/ci-cd.yml)

The authentication service behind the imapps apps (tandra, jewellery-catalogue,
…). It owns register/login, issues short-lived access tokens with rotating
refresh tokens, and exposes a `/verify` endpoint the other services call to
authorise a request. No UI — it's an internal service.

## What it does

- **Register / login** — passwords hashed with argon2id (`Bun.password`); legacy
  bcrypt hashes still verify and are upgraded on login.
- **Token issue + rotation** — login returns a short-lived access token (JWT) and
  sets an httpOnly refresh-token cookie. `/refresh` verifies the refresh token,
  checks it against the stored session, and rotates **both** tokens.
- **`/verify`** — a consuming service passes a bearer token and gets back the
  user id + username, or a 401.
- **`/logout`** — deletes the session so the refresh token can't be reused;
  **`/logout-all`** ends every session for the user.
- **`POST /users`** — look up users by username (rate-limited); used by the
  list/recipe sharing features in the consuming apps. With
  `LOOKUP_AUTH_ENABLED` it requires an access token or `X-Service-Token`.
- **`/.well-known/jwks.json`** — public key when signing ES256
  (`JWT_PRIVATE_KEY` set); `{keys:[]}` under HS256.
- **`/health`, `/ready`, `/metrics`** — health/readiness and Prometheus metrics
  (`/metrics` returns 404 to Cloudflare-proxied traffic).

## Architecture

Diagram: [`docs/diagrams/architecture.excalidraw`](docs/diagrams/architecture.excalidraw)
(open in excalidraw.com or the VS Code Excalidraw extension).

- **Hono** on the **Bun** runtime, TypeScript.
- **MongoDB** (native driver) via `@imapps/api-utils` — the shared package that
  provides config validation, the DI container, structured logging, and the
  Mongo connection helper. This repo is mostly just the auth logic.
- `jsonwebtoken` for signing (HS256 with `JWT_SECRET`, or ES256 when
  `JWT_PRIVATE_KEY` is set; `aud`/`iss` = `kivo`), `Bun.password` (argon2id) for
  hashing.
- **Sessions** live in their own MongoDB collection. The refresh token is stored
  as a SHA-256 hash, and a TTL index expires stale sessions with no cron.
- **Middleware stack**: CORS allow-list → request logging → Cloudflare header
  handling → security headers → a global in-memory rate limiter (skipped for
  `/health` and `/metrics`) → Prometheus request metrics.
- Each endpoint is a directory under `src/routes/` (`login`, `register`,
  `refresh`, `verify`, `logout`, `users`).
- **In-memory state**: global rate limit (55/min per IP, 300/min per verified
  user) and failed-login lockout (5 per username per 15 min).

## Running it

Requires **Bun 1.x** and a **MongoDB**. Copy `.env.example` to `.env`:

- Required: `PORT` (3008), `CONNECTION_URI`, `DATABASE_NAME`, `JWT_SECRET`
  (>= 32 chars), `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`, `SECURE`,
  `SAME_SITE` (`Strict|Lax|None`), `CORS_ALLOWED_ORIGINS`.
- Optional: `LOOKUP_AUTH_ENABLED`, `SERVICE_TOKEN` (same value shipped to
  consumer apps), `JWT_PRIVATE_KEY` (EC P-256 PKCS8 PEM, enables ES256 + JWKS).

```bash
bun install
bun start          # :3008, hot reload
bun test           # unit tests, tests/*.test.ts (in-memory fakes)
bun run lint       # Biome (lint:fix to apply)
bun run typecheck  # tsc --noEmit
bun run build      # bun build → build/
```

E2E: `bash scripts/e2e.sh` against a running server (`E2E_BASE_URL`, default
`http://localhost:3008`). `docker-compose.test.yml` provides a test Mongo on
port 27018.

## CI/CD

`pr-checks.yml` on PRs to `main`: lint, typecheck, test. `ci-cd.yml` on push to
`main`: semantic-release (version + changelog, conventional commits) → Docker
image published to Docker Hub `igurusama/imapps` → Dokploy deploy on `foundry`.
The image is multi-stage; the runner holds only `build/`, runs as `bun`, with a
healthcheck on `/health`.

Ingress: `kivo.imapps.uk` via Cloudflare tunnel → Traefik (Cloudflare Access
Bypass, kivo does its own auth). Consumer APIs call it in-cluster on
`dokploy-network` (`kivo-api-1pae1e:3008`). MongoDB is the shared `mongodb`
container on the same network.

## Decisions

- **Auth is a service, not a library.** Every imapps app calls the same
  `/verify`, so there is one place sessions live and one place to rotate a
  secret — worth the extra network hop.
- **Refresh-token rotation with a hashed, TTL'd session store.** Access tokens
  stay short and stateless; the refresh token is the revocable thing, only its
  hash is stored, and Mongo's TTL index handles expiry.
- **`@imapps/api-utils` for the plumbing.** Config, DI, logging and the DB
  connection are solved once across the apps rather than re-implemented here.
- **In-memory rate limiting.** Single instance, so a shared store would be
  overkill; it's a middleware function and swappable if it ever scales out.

## Licence

AGPL-3.0-or-later. See [LICENSE](LICENSE).
