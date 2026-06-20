import type { Context, Next } from 'hono';

export async function processCloudflareHeaders(c: Context, next: Next) {
    const cfVisitor = c.req.header('cf-visitor');
    if (cfVisitor) {
        try {
            const visitor = JSON.parse(cfVisitor) as { scheme: string };
            if (visitor.scheme === 'https') {
                c.res.headers.set('X-Forwarded-Proto', 'https');
            }
        } catch {
            // Ignore parsing errors
        }
    }
    await next();
}
