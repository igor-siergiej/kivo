FROM oven/bun:1.1.38-alpine AS builder

WORKDIR /app

# Install build dependencies for bcrypt native compilation
RUN apk add --no-cache python3 make g++

ARG NODE_AUTH_TOKEN

COPY package.json .npmrc ./

ENV NODE_AUTH_TOKEN=${NODE_AUTH_TOKEN}
RUN bun install

COPY . .

RUN bun run build

FROM oven/bun:1.1.38-alpine AS runner

WORKDIR /app

# Install build dependencies for bcrypt native compilation
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

ARG NODE_AUTH_TOKEN

COPY package.json .npmrc ./

ENV NODE_AUTH_TOKEN=${NODE_AUTH_TOKEN}
RUN bun install --production && \
    rm -rf /root/.bun/install/cache

# Remove build dependencies to keep image small
RUN apk del .build-deps

COPY --from=builder /app/build ./build

EXPOSE 3008

CMD ["bun", "run", "build/index.js"]

