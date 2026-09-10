# kivo

[![CI/CD](https://github.com/igor-siergiej/kivo/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/igor-siergiej/kivo/actions/workflows/ci-cd.yml)

The authentication service behind the imapps apps (shoppingo, jewellery-catalogue,
…). It owns register/login, issues short-lived access tokens with rotating
refresh tokens, and exposes a `/verify` endpoint the other services call to
authorise a request. No UI — it's an internal service.

## What it does

- **Register / login** — passwords hashed with bcrypt.
- **Token issue + rotation** — login returns a short-lived access token (JWT) and
  sets an httpOnly refresh-token cookie. `/refresh` verifies the refresh token,
  checks it against the stored session, and rotates **both** tokens.
- **`/verify`** — a consuming service passes a bearer token and gets back the
  user id + username, or a 401.
- **`/logout`** — deletes the session so the refresh token can't be reused.
- **`/search`, `/users`** — look up users by username (rate-limited); used by the
  list/recipe sharing features in the consuming apps.
- **`/health`, `/metrics`** — health check and Prometheus metrics.

## Architecture

- **Hono** on the **Bun** runtime, TypeScript.
- **MongoDB** (native driver) via `@imapps/api-utils` — the shared package that
  provides config validation, the DI container, structured logging, and the
  Mongo connection helper. This repo is mostly just the auth logic.
- `jsonwebtoken` for signing (with an `aud: "kivo"` claim), `bcryptjs` for
  hashing.
- **Sessions** live in their own MongoDB collection. The refresh token is stored
  as a SHA-256 hash, and a TTL index expires stale sessions with no cron.
- **Middleware stack**: CORS allow-list → request logging → Cloudflare header
  handling → security headers → a global in-memory rate limiter (skipped for
  `/health` and `/metrics`) → Prometheus request metrics.
- Each endpoint is a directory under `src/routes/` (`login`, `register`,
  `refresh`, `verify`, `logout`, `search`, `users`).

## Running it

Requires **Bun 1.x** and a **MongoDB**. Config in `.env` — `CONNECTION_URI`,
`DATABASE_NAME`, `PORT` (3008), `JWT_SECRET`, `ACCESS_TOKEN_EXPIRY`,
`REFRESH_TOKEN_EXPIRY`, `SECURE` / `SAME_SITE` cookie flags,
`CORS_ALLOWED_ORIGINS`.

```bash
bun install
bun start          # :3008, hot reload
bun test
bun run lint       # Biome
bun run build      # bun build → build/
```

## CI/CD

`ci-cd.yml` on push to `main`: lint → `bun test` → semantic-release (version +
changelog) → Docker image build/publish → deploy. Runs on Dokploy as an
internal service — no public URL.

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
