import { beforeEach, describe, expect, it } from 'bun:test';
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
    env.users.docs.push({
        _id,
        username,
        passwordHash: await Bun.password.hash(PASSWORD, { algorithm: 'bcrypt', cost: 4 }),
    });
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

    it('accepts symbols and rejects passwords that are too short, too long or lack a digit or letter', async () => {
        const register = (password: string, username: string) => postJson(app, '/register', { username, password });

        expect((await register('p@ss w0rd!#', 'symbols')).status).toBe(200);
        expect((await register('Sh0rt', 'short')).status).toBe(400);
        expect((await register('NoDigitsHere', 'nodigits')).status).toBe(400);
        expect((await register('12345678901', 'noletters')).status).toBe(400);
        expect((await register(`a1${'x'.repeat(71)}`, 'toolong')).status).toBe(400);
    });

    it('treats usernames case-insensitively and survives a duplicate-key race', async () => {
        await seedUser('alice');

        const differentCase = await postJson(app, '/register', { username: 'ALICE', password: PASSWORD });
        expect(differentCase.status).toBe(400);

        env.users.findOne = async () => null;
        const raced = await postJson(app, '/register', { username: 'Alice', password: PASSWORD });
        expect(raced.status).toBe(400);
        expect((await jsonBody(raced)).message).toBe('This username is already taken');
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

    it('upgrades a legacy bcrypt hash to argon2id on successful login', async () => {
        await seedUser();
        expect(env.users.docs[0].passwordHash).toStartWith('$2');

        expect((await postJson(app, '/login', { username: 'alice', password: PASSWORD })).status).toBe(200);

        expect(env.users.docs[0].passwordHash).toStartWith('$argon2id$');
        expect((await postJson(app, '/login', { username: 'alice', password: PASSWORD })).status).toBe(200);
    });

    it('returns the same 401 for unknown user and wrong password', async () => {
        await seedUser();

        const unknown = await postJson(app, '/login', { username: 'nobody', password: PASSWORD });
        const wrong = await postJson(app, '/login', { username: 'alice', password: 'WrongPassw0rd1' });

        expect(unknown.status).toBe(401);
        expect(wrong.status).toBe(401);
        expect(await jsonBody(unknown)).toEqual(await jsonBody(wrong));
    });

    it('logs in regardless of username case and issues the stored username', async () => {
        await seedUser('Alice');

        const response = await postJson(app, '/login', { username: 'aLiCe', password: PASSWORD });

        expect(response.status).toBe(200);
        expect(env.sessions.docs[0].username).toBe('Alice');
    });

    it('requires username and password', async () => {
        expect((await postJson(app, '/login', { username: 'alice' })).status).toBe(400);
    });
});

describe('login throttling', () => {
    it('locks an account after repeated failures, then recovers on success of another account', async () => {
        await seedUser('victim');
        await seedUser('other');
        const attempt = (username: string, password: string) => postJson(app, '/login', { username, password });

        for (let i = 0; i < 5; i++) {
            expect((await attempt('victim', 'WrongPassw0rd1')).status).toBe(401);
        }

        const locked = await attempt('VICTIM', PASSWORD);
        expect(locked.status).toBe(429);
        expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0);
        expect((await attempt('other', PASSWORD)).status).toBe(200);
    });

    it('counts failures for unknown usernames too, so existence is not revealed by lockout', async () => {
        for (let i = 0; i < 5; i++) {
            await postJson(app, '/login', { username: 'ghost', password: PASSWORD });
        }

        expect((await postJson(app, '/login', { username: 'ghost', password: PASSWORD })).status).toBe(429);
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
        expect(env.sessions.docs).toHaveLength(2);
        expect(original.rotatedAt).toBeInstanceOf(Date);
        expect(env.sessions.docs[1].familyId).toBe(original.familyId);
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

describe('refresh token reuse and logout-all', () => {
    const refreshWith = (cookie: string) => app.request('/refresh', { method: 'POST', headers: { Cookie: cookie } });

    const login = async () => {
        const response = await postJson(app, '/login', { username: 'alice', password: PASSWORD });
        return refreshCookie(response);
    };

    it('keeps the rotated session briefly, then revokes the whole family when a rotated token is replayed late', async () => {
        await seedUser();
        const original = await login();
        const other = await login();
        const rotated = refreshCookie(await refreshWith(original));

        expect((await refreshWith(original)).status).toBe(401);
        expect(env.sessions.docs.length).toBe(3);

        const rotatedSession = env.sessions.docs.find((session) => session.rotatedAt);
        (rotatedSession as { rotatedAt: Date }).rotatedAt = new Date(Date.now() - 60_000);

        expect((await refreshWith(original)).status).toBe(401);
        expect((await refreshWith(rotated)).status).toBe(401);
        expect((await refreshWith(other)).status).toBe(200);
    });

    it('logout-all revokes every session of the user', async () => {
        await seedUser();
        const first = await login();
        await login();
        await seedUser('bob');
        await postJson(app, '/login', { username: 'bob', password: PASSWORD });

        const response = await app.request('/logout-all', { method: 'POST', headers: { Cookie: first } });

        expect(response.status).toBe(200);
        expect(env.sessions.docs.every((session) => session.username === 'bob')).toBe(true);
        expect((await app.request('/logout-all', { method: 'POST', headers: { Cookie: first } })).status).toBe(401);
    });

    it('caps active sessions per user by dropping the oldest', async () => {
        await seedUser();
        const first = await login();
        for (let i = 0; i < 10; i++) await login();

        expect(env.sessions.docs).toHaveLength(10);
        expect((await refreshWith(first)).status).toBe(401);
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

describe('request validation', () => {
    it('rejects operator objects and non-string credentials without querying the database', async () => {
        await seedUser();

        const operator = await postJson(app, '/login', { username: { $ne: null }, password: PASSWORD });
        const numeric = await postJson(app, '/register', { username: 123, password: PASSWORD });
        const listPassword = await postJson(app, '/login', { username: 'alice', password: [PASSWORD] });

        expect(operator.status).toBe(400);
        expect(numeric.status).toBe(400);
        expect(listPassword.status).toBe(400);
        expect(env.users.docs).toHaveLength(1);
    });

    it('rejects oversized credentials', async () => {
        expect((await postJson(app, '/login', { username: 'a'.repeat(65), password: PASSWORD })).status).toBe(400);
        expect((await postJson(app, '/login', { username: 'alice', password: 'a'.repeat(1025) })).status).toBe(400);
    });

    it('returns 400 for malformed or non-object JSON bodies', async () => {
        const malformed = await app.request('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{not json',
        });

        expect(malformed.status).toBe(400);
        expect((await postJson(app, '/login', ['alice'])).status).toBe(400);
    });

    it('rejects /users payloads containing non-strings or too many names', async () => {
        expect((await postJson(app, '/users', { usernames: ['alice', { $ne: null }] })).status).toBe(400);
        expect(
            (await postJson(app, '/users', { usernames: Array.from({ length: 101 }, (_, i) => `u${i}`) })).status
        ).toBe(400);
    });
});

describe('error handling', () => {
    it('hides internal error messages from clients and logs them', async () => {
        env.users.findOne = async () => {
            throw new Error('mongo connection string mongodb://secret@host failed');
        };

        const response = await postJson(app, '/login', { username: 'alice', password: PASSWORD });
        const body = await jsonBody(response);

        expect(response.status).toBe(500);
        expect(body.message).toBe('Internal Server Error');
        expect(JSON.stringify(body)).not.toContain('secret');
    });
});

describe('lookup endpoint authentication', () => {
    const accessToken = () => sign({ id: 'u1', aud: 'kivo', tokenType: 'access' }, TEST_SECRET, { expiresIn: '5m' });

    beforeEach(() => {
        env = installFakes({ lookupAuthEnabled: true, serviceToken: 'svc-token-123' });
        app = buildApp();
    });

    it('requires credentials on /users and /search when enabled', async () => {
        expect((await postJson(app, '/users', { usernames: ['alice'] })).status).toBe(401);
        expect((await app.request('/search?q=alice')).status).toBe(401);
        expect((await postJson(app, '/users', { usernames: ['alice'] }, { 'x-service-token': 'wrong' })).status).toBe(
            401
        );
    });

    it('accepts an access token, and a service token only for /users', async () => {
        const bearer = { Authorization: `Bearer ${accessToken()}` };

        expect((await postJson(app, '/users', { usernames: [] }, bearer)).status).toBe(200);
        expect((await postJson(app, '/users', { usernames: [] }, { 'x-service-token': 'svc-token-123' })).status).toBe(
            200
        );
        expect((await app.request('/search?q=a', { headers: bearer })).status).toBe(400);
        expect((await app.request('/search?q=alice', { headers: { 'x-service-token': 'svc-token-123' } })).status).toBe(
            401
        );
    });
});
