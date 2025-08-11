FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

ENV YARN_NODE_LINKER=node-modules

RUN corepack enable && corepack prepare yarn@4.9.2 --activate

RUN yarn install --immutable

COPY . .

RUN yarn install --immutable

RUN yarn build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json yarn.lock ./

ENV YARN_NODE_LINKER=node-modules

RUN corepack enable && corepack prepare yarn@4.9.2 --activate && \
    yarn install --immutable && \
    yarn cache clean && \
    rm -rf /root/.cache

COPY --from=builder /app/build ./build

EXPOSE 3008

CMD ["node", "build/index.js"]

