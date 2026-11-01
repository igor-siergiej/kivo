import { beforeEach, describe, expect, it } from 'bun:test';

import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';

import { verifyToken } from '../src/lib/auth/index';
import { createErrorHandler } from '../src/lib/errors/handler';
import { normalizePath } from '../src/lib/metrics';
import { credentialsSchema, readJsonBody } from '../src/lib/validation';
import { buildApp, jsonBody, postJson, SilentLogger } from './helpers/app';
import { installFakes, TEST_SECRET } from './helpers/fakes';

beforeEach(() => {
    installFakes();
});

const bodyApp = () => {
    const app = new Hono();
    app.onError(createErrorHandler(new SilentLogger()));
    app.post('/credentials', async (c) => c.json(await readJsonBody(c, credentialsSchema)));

    return app;
};

const rawPost = (app: Hono, body: string) =>
    app.request('/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

describe('readJsonBody', () => {
    it('reports invalid JSON and non-object bodies with distinct messages', async () => {
        const app = bodyApp();

        const malformed = await rawPost(app, '{not json');
        const list = await rawPost(app, '["alice"]');
        const missing = await rawPost(app, 'null');

        expect([malformed.status, list.status, missing.status]).toEqual([400, 400, 400]);
        expect((await jsonBody(malformed)).message).toBe('Request body must be valid JSON');
        expect((await jsonBody(list)).message).toBe('Request body must be a JSON object');
        expect((await jsonBody(missing)).message).toBe('Request body must be a JSON object');
    });

    it('decodes credential fields leniently: only non-empty, bounded strings survive', async () => {
        const app = bodyApp();
        const good = await rawPost(app, JSON.stringify({ username: 'alice', password: 'Passw0rdPassw0rd', extra: 1 }));
        const bad = await rawPost(app, JSON.stringify({ username: 7, password: '' }));

        expect(await good.json()).toEqual({ username: 'alice', password: 'Passw0rdPassw0rd' });
        expect(await bad.json()).toEqual({});
    });
});

describe('verifyToken', () => {
    it('decodes the claims the app reads and drops unknown tokenType values', () => {
        const access = sign(
            { sub: 'alice', id: 'u1', username: 'alice', aud: 'kivo', tokenType: 'access' },
            TEST_SECRET
        );

        const odd = sign({ sub: 'alice', aud: 'kivo', tokenType: 'bogus' }, TEST_SECRET);

        expect(verifyToken(access, TEST_SECRET)).toMatchObject({ sub: 'alice', id: 'u1', tokenType: 'access' });
        expect(verifyToken(odd, TEST_SECRET).tokenType).toBeUndefined();
    });

    it('rejects a token whose payload is a bare string', () => {
        const stringPayload = sign('just a string', TEST_SECRET);

        expect(() => verifyToken(stringPayload, TEST_SECRET)).toThrow();
    });
});

describe('POST /refresh with a token that has no subject', () => {
    it('responds 401 Invalid session', async () => {
        const app = buildApp();
        const token = sign({ aud: 'kivo', tokenType: 'refresh' }, TEST_SECRET, { expiresIn: '5m' });

        const response = await app.request('/refresh', {
            method: 'POST',
            headers: { Cookie: `refreshToken=${token}` },
        });

        expect(response.status).toBe(401);
        expect((await jsonBody(response)).message).toBe('Invalid session');
    });
});

describe('POST /users', () => {
    it('rejects a body without a usernames list', async () => {
        const response = await postJson(buildApp(), '/users', { names: ['alice'] });

        expect(response.status).toBe(400);
    });
});

describe('normalizePath', () => {
    it('keeps known paths and groups everything else, including inherited object keys', () => {
        expect(normalizePath('/login')).toBe('/login');
        expect(normalizePath('/nope')).toBe('other');
        expect(normalizePath('constructor')).toBe('other');
    });
});
