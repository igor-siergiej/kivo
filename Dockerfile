FROM oven/bun:1.1.38-alpine AS builder

WORKDIR /app

ARG NODE_AUTH_TOKEN

COPY package.json bun.lock .npmrc ./

RUN sed -i "s/\${NODE_AUTH_TOKEN}/${NODE_AUTH_TOKEN}/g" .npmrc

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1.1.38-alpine AS runner

WORKDIR /app

ARG NODE_AUTH_TOKEN

COPY package.json bun.lock .npmrc ./

RUN sed -i "s/\${NODE_AUTH_TOKEN}/${NODE_AUTH_TOKEN}/g" .npmrc

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production --frozen-lockfile

COPY --from=builder /app/build ./build

EXPOSE 3008

CMD ["bun", "run", "build/index.js"]
