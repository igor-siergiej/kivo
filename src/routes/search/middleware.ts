import { FixedWindowLimiter, type RateLimitResult } from '../../lib/rateLimiter.js';
import { getClientIP } from '../../lib/utils/getClientIP.js';

const SEARCH_MAX_REQUESTS = 30;
const searchLimiter = new FixedWindowLimiter(60 * 1000);

export function checkSearchRateLimit(request: Request): RateLimitResult {
    return searchLimiter.check(getClientIP(request), SEARCH_MAX_REQUESTS);
}
