import { describe, expect, it } from 'bun:test';
import { sign } from 'jsonwebtoken';
import {
    ANONYMOUS_MAX_REQUESTS,
    AUTHENTICATED_MAX_REQUESTS,
    checkGlobalRateLimit,
    getVerifiedUserId,
} from '../src/middleware/rateLimit';

const SECRET = 'test-secret';

const requestFrom = (ip: string, token?: string) =>
    new Request('http://kivo/verify', {
        headers: { 'x-forwarded-for': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });

const accessToken = (id: string, overrides: Record<string, unknown> = {}) =>
    sign({ id, username: id, aud: 'kivo', tokenType: 'access', ...overrides }, SECRET, { expiresIn: '5m' });

const exhaust = (ip: string, userId: string | undefined, count: number) => {
    for (let i = 0; i < count; i++) checkGlobalRateLimit(requestFrom(ip), userId);
};

describe('getVerifiedUserId', () => {
    it('returns the user id of a validly signed kivo token', () => {
        expect(getVerifiedUserId(requestFrom('1.1.1.1', accessToken('user-1')), SECRET)).toBe('user-1');
    });

    it('rejects forged, wrong-audience, expired and malformed credentials', () => {
        const refreshType = accessToken('user-1', { tokenType: 'refresh' });
        const forged = sign({ id: 'user-1', aud: 'kivo' }, 'attacker-secret');
        const wrongAudience = accessToken('user-1', { aud: 'something-else' });
        const expired = sign({ id: 'user-1', aud: 'kivo' }, SECRET, { expiresIn: -10 });

        expect(getVerifiedUserId(requestFrom('1.1.1.1', refreshType), SECRET)).toBeUndefined();
        expect(getVerifiedUserId(requestFrom('1.1.1.1', forged), SECRET)).toBeUndefined();
        expect(getVerifiedUserId(requestFrom('1.1.1.1', wrongAudience), SECRET)).toBeUndefined();
        expect(getVerifiedUserId(requestFrom('1.1.1.1', expired), SECRET)).toBeUndefined();
        expect(getVerifiedUserId(requestFrom('1.1.1.1', 'not-a-jwt'), SECRET)).toBeUndefined();
        expect(getVerifiedUserId(requestFrom('1.1.1.1'), SECRET)).toBeUndefined();
    });
});

describe('checkGlobalRateLimit', () => {
    it('limits anonymous traffic per IP without affecting other IPs', () => {
        exhaust('10.0.0.1', undefined, ANONYMOUS_MAX_REQUESTS);

        const blocked = checkGlobalRateLimit(requestFrom('10.0.0.1'));
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfter).toBeGreaterThan(0);
        expect(checkGlobalRateLimit(requestFrom('10.0.0.2')).allowed).toBe(true);
    });

    it('lets an authenticated user exceed the anonymous limit from a shared IP', () => {
        // Same IP as the exhausted anonymous bucket above: e.g. shoppingo verifying for many users.
        exhaust('10.0.0.3', undefined, ANONYMOUS_MAX_REQUESTS);
        expect(checkGlobalRateLimit(requestFrom('10.0.0.3')).allowed).toBe(false);

        exhaust('10.0.0.3', 'alice', ANONYMOUS_MAX_REQUESTS + 1);
        expect(checkGlobalRateLimit(requestFrom('10.0.0.3'), 'alice').allowed).toBe(true);
    });

    it('still caps an authenticated user, and keeps users independent', () => {
        exhaust('10.0.0.4', 'bob', AUTHENTICATED_MAX_REQUESTS);

        expect(checkGlobalRateLimit(requestFrom('10.0.0.4'), 'bob').allowed).toBe(false);
        expect(checkGlobalRateLimit(requestFrom('10.0.0.4'), 'carol').allowed).toBe(true);
    });
});
