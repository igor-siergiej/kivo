import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'build',
    target: 'node22',
    format: ['cjs'],
    splitting: false,
    shims: false,
    sourcemap: true,
    clean: true,
    dts: false,
    external: ['koa', 'koa-body', 'koa-cors', 'koa-helmet', 'koa-logger', 'koa-ratelimit', 'koa-router', 'mongodb', 'bcrypt', 'jsonwebtoken']
});
