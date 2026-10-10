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
