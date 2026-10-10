import type { Context, Next } from 'hono';

/**
 * Hides a route from public traffic. Everything public reaches kivo through Cloudflare, which always
 * adds cf-connecting-ip; in-cluster callers (Prometheus) go direct and never carry it.
 */
export async function internalOnly(c: Context, next: Next) {
    if (c.req.header('cf-connecting-ip')) {
        return c.json({ error: 'Not Found' }, 404);
    }
    await next();
}
