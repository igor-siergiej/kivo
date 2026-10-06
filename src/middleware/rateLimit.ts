import { verify } from 'jsonwebtoken';
import { getClientIP } from '../lib/utils/getClientIP.js';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const WINDOW_MS = 60 * 1000;
// Unauthenticated traffic (bots, scanners, login attempts) is keyed by IP and kept tight.
export const ANONYMOUS_MAX_REQUESTS = 55;
// A request carrying a validly signed kivo token is keyed by user id, so one person's
// traffic (and every service verifying on their behalf) cannot be starved by others.
export const AUTHENTICATED_MAX_REQUESTS = 300;

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000);

/**
 * Returns the user id of a validly signed, unexpired kivo access token in the Authorization
 * header, or undefined. The signature is checked so a client cannot mint itself fresh
 * per-user buckets by sending arbitrary bearer strings.
 */
export function getVerifiedUserId(request: Request, jwtSecret: string): string | undefined {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return undefined;

    try {
        const payload = verify(authHeader.slice('Bearer '.length), jwtSecret);
        if (typeof payload === 'string') return undefined;
        return payload.aud === 'kivo' && typeof payload.id === 'string' && payload.id ? payload.id : undefined;
    } catch {
        return undefined;
    }
}

export function checkGlobalRateLimit(request: Request, userId?: string): { allowed: boolean; retryAfter?: number } {
    const key = userId ? `user:${userId}` : `ip:${getClientIP(request)}`;
    const maxRequests = userId ? AUTHENTICATED_MAX_REQUESTS : ANONYMOUS_MAX_REQUESTS;
    const now = Date.now();

    const clientData = rateLimitStore.get(key);

    if (!clientData || now > clientData.resetTime) {
        // New window
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + WINDOW_MS,
        });
        return { allowed: true };
    }

    if (clientData.count >= maxRequests) {
        // Rate limit exceeded
        return {
            allowed: false,
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        };
    }

    // Increment counter
    clientData.count++;
    return { allowed: true };
}
