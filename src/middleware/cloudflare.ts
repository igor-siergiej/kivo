import type { Context } from 'elysia';

export function processCloudflareHeaders(ctx: Context) {
    // Process CF-Visitor header to set protocol
    const cfVisitor = ctx.request.headers.get('cf-visitor');
    if (cfVisitor) {
        try {
            const visitor = JSON.parse(cfVisitor) as { scheme: string };
            if (visitor.scheme === 'https') {
                ctx.set.headers['X-Forwarded-Proto'] = 'https';
            }
        } catch {
            // Ignore parsing errors
        }
    }
}
