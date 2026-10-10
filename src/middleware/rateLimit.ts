import { verifyToken } from '../lib/auth/index.js';
import { FixedWindowLimiter, type RateLimitResult } from '../lib/rateLimiter.js';
import { getClientIP } from '../lib/utils/getClientIP.js';

const WINDOW_MS = 60 * 1000;
// Unauthenticated traffic (bots, scanners, login attempts) is keyed by IP and kept tight.
export const ANONYMOUS_MAX_REQUESTS = 55;
// A request carrying a validly signed kivo token is keyed by user id, so one person's
// traffic (and every service verifying on their behalf) cannot be starved by others.
export const AUTHENTICATED_MAX_REQUESTS = 300;

const limiter = new FixedWindowLimiter(WINDOW_MS);

/**
 * Returns the user id of a validly signed, unexpired kivo access token in the Authorization
 * header, or undefined. The signature is checked so a client cannot mint itself fresh
 * per-user buckets by sending arbitrary bearer strings.
 */
export function getVerifiedUserId(request: Request, jwtSecret: string): string | undefined {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return undefined;

    try {
        const payload = verifyToken(authHeader.slice('Bearer '.length), jwtSecret);
        return payload.tokenType === 'access' && typeof payload.id === 'string' && payload.id ? payload.id : undefined;
    } catch {
        return undefined;
    }
}

export function checkGlobalRateLimit(request: Request, userId?: string): RateLimitResult {
    const key = userId ? `user:${userId}` : `ip:${getClientIP(request)}`;
    return limiter.check(key, userId ? AUTHENTICATED_MAX_REQUESTS : ANONYMOUS_MAX_REQUESTS);
}
