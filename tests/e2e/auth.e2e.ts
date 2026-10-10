import { describe, expect, it } from 'bun:test';
import { jsonBody } from '../helpers/app';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3008';

describe('kivo @smoke', () => {
    it('reports healthy @smoke', async () => {
        const response = await fetch(`${baseUrl}/health`);
        const data = await jsonBody(response);

        expect(response.status).toBe(200);
        expect(data.status).toBe('healthy');
        expect(data.service).toBe('kivo');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('x-frame-options')).toBe('DENY');
        expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    });
});

describe('kivo metrics', () => {
    it('serves metrics to internal callers but hides them from Cloudflare-proxied traffic', async () => {
        const internal = await fetch(`${baseUrl}/metrics`);
        const proxied = await fetch(`${baseUrl}/metrics`, { headers: { 'cf-connecting-ip': '203.0.113.7' } });

        expect(proxied.status).toBe(404);
        // Live runs go through Cloudflare, so only assert the internal path locally
        if (!process.env.E2E_BASE_URL?.startsWith('https://')) {
            expect(internal.status).toBe(200);
        }
    });
});

describe('kivo error envelope', () => {
    it('answers unknown routes with the standard {success,message} shape', async () => {
        const response = await fetch(`${baseUrl}/nope`);
        const body = await jsonBody(response);

        expect(response.status).toBe(404);
        expect(body).toMatchObject({ success: false, message: 'Not Found' });
    });
});

describe('kivo readiness', () => {
    it('reports ready when the database answers', async () => {
        const response = await fetch(`${baseUrl}/ready`);

        expect(response.status).toBe(200);
        expect((await jsonBody(response)).status).toBe('ready');
    });
});

describe('kivo auth flow', () => {
    const username = `e2e${Date.now()}`;
    const password = 'Passw0rdPassw0rd';
    const jsonHeaders = { 'Content-Type': 'application/json' };
    let refreshCookie = '';

    const cookieFrom = (response: Response) => (response.headers.get('set-cookie') ?? '').split(';')[0];

    it('registers, verifies, refreshes and logs out', async () => {
        const registered = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ username, password }),
        });
        expect(registered.status).toBe(200);
        const { accessToken } = await jsonBody(registered);
        refreshCookie = cookieFrom(registered);
        expect(refreshCookie).toStartWith('refreshToken=');

        const verified = await fetch(`${baseUrl}/verify`, { headers: { Authorization: `Bearer ${accessToken}` } });
        expect(verified.status).toBe(200);
        expect((await jsonBody(verified)).payload.username).toBe(username);

        const refreshed = await fetch(`${baseUrl}/refresh`, { method: 'POST', headers: { Cookie: refreshCookie } });
        expect(refreshed.status).toBe(200);
        expect((await jsonBody(refreshed)).accessToken).toBeString();
        const rotatedCookie = cookieFrom(refreshed);

        const replayed = await fetch(`${baseUrl}/refresh`, { method: 'POST', headers: { Cookie: refreshCookie } });
        expect(replayed.status).toBe(401);

        const asAccess = await fetch(`${baseUrl}/verify`, {
            headers: { Authorization: `Bearer ${refreshCookie.split('=')[1]}` },
        });
        expect(asAccess.status).toBe(401);

        const loggedOut = await fetch(`${baseUrl}/logout`, { method: 'POST', headers: { Cookie: rotatedCookie } });
        expect(loggedOut.status).toBe(200);
    });

    it('rejects oversized bodies with 413', async () => {
        const response = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ username, password: 'a'.repeat(20000) }),
        });
        expect(response.status).toBe(413);
    });

    it('rejects a wrong password', async () => {
        const response = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ username, password: 'WrongPassw0rd1' }),
        });
        expect(response.status).toBe(401);
    });
});
