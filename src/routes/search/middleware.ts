import type { Context, Next } from 'hono';
import { getClientIP } from '../../lib/utils/getClientIP.js';

const searchRateLimit = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries every minute
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of searchRateLimit.entries()) {
        if (now > data.resetTime) {
            searchRateLimit.delete(ip);
        }
    }
}, 60000);

export function checkSearchRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
    const clientIP = getClientIP(request);
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 30;

    const clientData = searchRateLimit.get(clientIP);

    if (!clientData || now > clientData.resetTime) {
        searchRateLimit.set(clientIP, {
            count: 1,
            resetTime: now + windowMs,
        });
        return { allowed: true };
    }

    if (clientData.count >= maxRequests) {
        return {
            allowed: false,
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        };
    }

    clientData.count++;
    return { allowed: true };
}

export async function searchSecurityMiddleware(c: Context, next: Next) {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    await next();
}

export async function searchRateLimitMiddleware(c: Context, next: Next) {
    const rateLimitResult = checkSearchRateLimit(c.req.raw);

    if (!rateLimitResult.allowed) {
        return c.json(
            {
                success: false,
                message: 'Search rate limit exceeded. Please try again later.',
                retryAfter: rateLimitResult.retryAfter,
            },
            429
        );
    }
    await next();
}
