import type { Context, Next } from 'hono';

export async function applySecurityHeaders(c: Context, next: Next) {
    await next();
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('X-Frame-Options', 'DENY');
    c.res.headers.set('X-XSS-Protection', '1; mode=block');
}
