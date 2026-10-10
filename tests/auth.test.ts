import { beforeEach, describe, expect, it } from 'bun:test';
import bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { buildApp, jsonBody, postJson, refreshCookie } from './helpers/app';
import { installFakes, newId, TEST_SECRET, type TestEnvironment } from './helpers/fakes';

const PASSWORD = 'Passw0rdPassw0rd';

let env: TestEnvironment;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
    env = installFakes();
    app = buildApp();
});

const seedUser = async (username = 'alice') => {
    const _id = newId();
    env.users.docs.push({ _id, username, passwordHash: await bcrypt.hash(PASSWORD, 4) });
    return _id;
};

describe('POST /register', () => {
    it('creates a user, a session and sets the refresh cookie', async () => {
        const response = await postJson(app, '/register', { username: 'alice', password: PASSWORD });

        expect(response.status).toBe(200);
        expect((await jsonBody(response)).accessToken).toBeString();
        expect(refreshCookie(response)).toStartWith('refreshToken=');
        expect(env.users.docs).toHaveLength(1);
        expect(env.sessions.docs).toHaveLength(1);
        expect(env.users.docs[0].passwordHash).not.toBe(PASSWORD);
    });

    it('rejects missing credentials, weak passwords and taken usernames', async () => {
        await seedUser();

        expect((await postJson(app, '/register', { username: 'bob' })).status).toBe(400);
        expect((await postJson(app, '/register', { username: 'bob', password: 'short1' })).status).toBe(400);
        expect((await postJson(app, '/register', { username: 'alice', password: PASSWORD })).status).toBe(400);
    });
});

describe('POST /login', () => {
    it('issues tokens and stores a hashed session for valid credentials', async () => {
        await seedUser();

        const response = await postJson(app, '/login', { username: 'alice', password: PASSWORD });

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(env.sessions.docs).toHaveLength(1);
        expect(env.sessions.docs[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns the same 401 for unknown user and wrong password', async () => {
        await seedUser();

        const unknown = await postJson(app, '/login', { username: 'nobody', password: PASSWORD });
        const wrong = await postJson(app, '/login', { username: 'alice', password: 'WrongPassw0rd1' });

        expect(unknown.status).toBe(401);
        expect(wrong.status).toBe(401);
        expect(await jsonBody(unknown)).toEqual(await jsonBody(wrong));
    });

    it('requires username and password', async () => {
        expect((await postJson(app, '/login', { username: 'alice' })).status).toBe(400);
    });
});

describe('GET /verify', () => {
    const verifyWith = (token?: string) =>
        app.request('/verify', { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    it('accepts a valid kivo token and returns its identity', async () => {
        const token = sign({ id: 'u1', username: 'alice', aud: 'kivo', tokenType: 'access' }, TEST_SECRET, {
            expiresIn: '5m',
        });

        const response = await verifyWith(token);

        expect(response.status).toBe(200);
        expect((await jsonBody(response)).payload).toEqual({ id: 'u1', username: 'alice' });
    });

    it('rejects a refresh token presented as an access token', async () => {
        const refreshToken = sign({ id: 'u1', username: 'alice', aud: 'kivo', tokenType: 'refresh' }, TEST_SECRET, {
            expiresIn: '7d',
        });

        expect((await verifyWith(refreshToken)).status).toBe(401);
    });

    it('rejects missing, forged, expired and wrong-audience tokens', async () => {
        const forged = sign({ aud: 'kivo' }, 'other-secret');
        const expired = sign({ aud: 'kivo' }, TEST_SECRET, { expiresIn: -10 });
        const wrongAudience = sign({ aud: 'other' }, TEST_SECRET, { expiresIn: '5m' });

        expect((await verifyWith()).status).toBe(401);
        expect((await verifyWith(forged)).status).toBe(401);
        expect((await verifyWith(expired)).status).toBe(401);
        expect((await verifyWith(wrongAudience)).status).toBe(401);
    });
});

describe('POST /refresh and /logout', () => {
    const loginCookie = async () => {
        await seedUser();
        return refreshCookie(await postJson(app, '/login', { username: 'alice', password: PASSWORD }));
    };

    it('rotates the session and returns a new access token', async () => {
        const cookie = await loginCookie();
        const [original] = env.sessions.docs;

        const response = await app.request('/refresh', { method: 'POST', headers: { Cookie: cookie } });

        expect(response.status).toBe(200);
        expect((await jsonBody(response)).accessToken).toBeString();
        expect(env.sessions.docs).toHaveLength(1);
        expect(env.sessions.docs[0]._id).not.toBe(original._id);
    });

    it('rejects an access token used as the refresh cookie and a replayed refresh token', async () => {
        const cookie = await loginCookie();
        const accessToken = sign({ sub: 'alice', aud: 'kivo', tokenType: 'access' }, TEST_SECRET, { expiresIn: '5m' });

        const asRefresh = await app.request('/refresh', {
            method: 'POST',
            headers: { Cookie: `refreshToken=${accessToken}` },
        });
        expect(asRefresh.status).toBe(401);

        expect((await app.request('/refresh', { method: 'POST', headers: { Cookie: cookie } })).status).toBe(200);
        expect((await app.request('/refresh', { method: 'POST', headers: { Cookie: cookie } })).status).toBe(401);
    });

    it('rejects a missing cookie, an unknown session and a forged token', async () => {
        const cookie = await loginCookie();
        env.sessions.docs.length = 0;
        const forged = sign({ sub: 'alice', aud: 'kivo' }, 'other-secret');

        expect((await app.request('/refresh', { method: 'POST' })).status).toBe(400);
        expect((await app.request('/refresh', { method: 'POST', headers: { Cookie: cookie } })).status).toBe(401);
        expect(
            (await app.request('/refresh', { method: 'POST', headers: { Cookie: `refreshToken=${forged}` } })).status
        ).toBe(401);
    });

    it('logout deletes the session and clears the cookie', async () => {
        const cookie = await loginCookie();

        const response = await app.request('/logout', { method: 'POST', headers: { Cookie: cookie } });

        expect(response.status).toBe(200);
        expect(env.sessions.docs).toHaveLength(0);
        expect(response.headers.get('set-cookie')).toContain('refreshToken=;');
        expect((await app.request('/logout', { method: 'POST' })).status).toBe(400);
    });
});

describe('POST /users', () => {
    it('returns found users and the names that were not found', async () => {
        const id = await seedUser('alice');

        const response = await postJson(app, '/users', { usernames: ['alice', 'ghost'] });
        const body = await jsonBody(response);

        expect(body.users).toEqual([{ id: id.toString(), username: 'alice' }]);
        expect(body.notFoundUsernames).toEqual(['ghost']);
    });

    it('validates the usernames array', async () => {
        expect((await postJson(app, '/users', { usernames: 'alice' })).status).toBe(400);
        expect((await jsonBody(await postJson(app, '/users', { usernames: [] }))).users).toEqual([]);
    });
});

describe('GET /search', () => {
    it('validates the query and limit before touching the database', async () => {
        expect((await app.request('/search')).status).toBe(400);
        expect((await app.request('/search?q=a')).status).toBe(400);
        expect((await app.request(`/search?q=${'x'.repeat(51)}`)).status).toBe(400);
        expect((await app.request('/search?q=alice&limit=99')).status).toBe(400);
    });
});
