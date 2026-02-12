import type { Context } from 'elysia';

export function applySecurityHeaders(ctx: Context) {
    ctx.set.headers['X-Content-Type-Options'] = 'nosniff';
    ctx.set.headers['X-Frame-Options'] = 'DENY';
    ctx.set.headers['X-XSS-Protection'] = '1; mode=block';
}
