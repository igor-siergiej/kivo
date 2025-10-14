FROM oven/bun:1.1.38-alpine AS builder

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

RUN bun run build

FROM oven/bun:1.1.38-alpine AS runner

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun install --frozen-lockfile --production --ignore-scripts && \
    rm -rf /root/.bun/install/cache

COPY --from=builder /app/build ./build

EXPOSE 3008

CMD ["bun", "run", "build/index.js"]

