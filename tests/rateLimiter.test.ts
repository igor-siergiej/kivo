import { describe, expect, it } from 'bun:test';
import { FixedWindowLimiter } from '../src/lib/rateLimiter';

describe('FixedWindowLimiter', () => {
    it('blocks after the limit within a window and reports retryAfter', () => {
        const limiter = new FixedWindowLimiter(60_000);

        expect(limiter.check('a', 2).allowed).toBe(true);
        expect(limiter.check('a', 2).allowed).toBe(true);
        const blocked = limiter.check('a', 2);

        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfter).toBeGreaterThan(0);
        expect(limiter.check('b', 2).allowed).toBe(true);
    });

    it('never holds more than maxKeys live keys, evicting the oldest', () => {
        const limiter = new FixedWindowLimiter(60_000, 3);

        for (const key of ['a', 'b', 'c', 'd', 'e']) limiter.check(key, 1);

        expect(limiter.size).toBe(3);
        // the oldest key was evicted, so it starts a fresh window rather than staying blocked
        expect(limiter.check('a', 1).allowed).toBe(true);
    });
});
