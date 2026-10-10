FROM oven/bun:1.1.38-alpine AS builder

WORKDIR /app

# Only this stage sees the registry token; it never reaches the final image
ARG NODE_AUTH_TOKEN

COPY package.json bun.lock .npmrc ./

RUN sed -i "s/\${NODE_AUTH_TOKEN}/${NODE_AUTH_TOKEN}/g" .npmrc

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1.1.38-alpine AS runner

WORKDIR /app

# build/index.js is a self-contained bundle, so no dependency install (and no .npmrc) is needed here
COPY --from=builder --chown=bun:bun /app/build ./build

USER bun

EXPOSE 3008

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3008/health >/dev/null || exit 1

CMD ["bun", "run", "build/index.js"]
