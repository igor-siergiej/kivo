import { Context, Next } from 'koa';

const searchRateLimit = new Map<string, { count: number; resetTime: number }>();

export const searchRateLimitMiddleware = async (ctx: Context, next: Next) => {
    const clientIP = ctx.ip || ctx.request.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 30;

    for (const [ip, data] of searchRateLimit.entries()) {
        if (now > data.resetTime) {
            searchRateLimit.delete(ip);
        }
    }

    const clientData = searchRateLimit.get(clientIP);
    
    if (!clientData || now > clientData.resetTime) {
        searchRateLimit.set(clientIP, {
            count: 1,
            resetTime: now + windowMs
        });
    } else if (clientData.count >= maxRequests) {
        ctx.status = 429;
        ctx.body = {
            success: false,
            message: 'Search rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        };
        return;
    } else {
        clientData.count++;
    }

    await next();
};

export const searchSecurityMiddleware = async (ctx: Context, next: Next) => {
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.set('X-XSS-Protection', '1; mode=block');
    
    ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    ctx.set('Pragma', 'no-cache');
    ctx.set('Expires', '0');
    
    await next();
};
