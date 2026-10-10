import { beforeEach, describe, expect, it } from 'bun:test';
import crypto from 'node:crypto';
import { decode, sign, verify } from 'jsonwebtoken';
import { buildApp, jsonBody, postJson } from './helpers/app';
import { installFakes, newId, TEST_SECRET, type TestEnvironment } from './helpers/fakes';

const PASSWORD = 'Passw0rdPassw0rd';
const pem = crypto
    .generateKeyPairSync('ec', { namedCurve: 'P-256' })
    .privateKey.export({ type: 'pkcs8', format: 'pem' })
    .toString();

let env: TestEnvironment;
let app: ReturnType<typeof buildApp>;

const registerAndGetToken = async () => {
    const response = await postJson(app, '/register', { username: 'alice', password: PASSWORD });
    return (await jsonBody(response)).accessToken as string;
};

describe('asymmetric tokens', () => {
    beforeEach(() => {
        env = installFakes({ jwtPrivateKey: pem.replace(/\n/g, '\\n') });
        app = buildApp();
    });

    it('signs ES256 with a kid and verifies via /verify', async () => {
        const token = await registerAndGetToken();

        const header = decode(token, { complete: true })?.header;
        expect(header?.alg).toBe('ES256');
        expect(header?.kid).toBeString();
        expect((await app.request('/verify', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    });

    it('publishes a JWKS whose key verifies the issued tokens without the shared secret', async () => {
        const token = await registerAndGetToken();

        const { keys } = await jsonBody(await app.request('/.well-known/jwks.json'));
        const publicKey = crypto.createPublicKey({ key: keys[0], format: 'jwk' });

        expect(keys).toHaveLength(1);
        expect(keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' });
        expect(keys[0].d).toBeUndefined();
        expect(decode(token, { complete: true })?.header.kid).toBe(keys[0].kid);
        expect(verify(token, publicKey, { algorithms: ['ES256'] })).toMatchObject({ username: 'alice' });
    });

    it('still accepts HS256 tokens issued before the key was configured', async () => {
        const legacy = sign({ id: 'u1', username: 'alice', aud: 'kivo', tokenType: 'access' }, TEST_SECRET, {
            expiresIn: '5m',
        });

        expect((await app.request('/verify', { headers: { Authorization: `Bearer ${legacy}` } })).status).toBe(200);
    });

    it('rejects a token that claims ES256 but is signed with a different key', async () => {
        const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
        const forged = sign({ id: 'u1', aud: 'kivo', tokenType: 'access' }, other, { algorithm: 'ES256' });

        expect((await app.request('/verify', { headers: { Authorization: `Bearer ${forged}` } })).status).toBe(401);
    });
});

describe('without a configured key', () => {
    beforeEach(() => {
        env = installFakes();
        app = buildApp();
    });

    it('issues HS256, serves an empty JWKS and rejects ES256 tokens', async () => {
        env.users.docs.push({ _id: newId(), username: 'bob', passwordHash: 'x' });
        const token = await registerAndGetToken();
        const forged = sign(
            { aud: 'kivo', tokenType: 'access' },
            crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey,
            {
                algorithm: 'ES256',
            }
        );

        expect(decode(token, { complete: true })?.header.alg).toBe('HS256');
        expect(await jsonBody(await app.request('/.well-known/jwks.json'))).toEqual({ keys: [] });
        expect((await app.request('/verify', { headers: { Authorization: `Bearer ${forged}` } })).status).toBe(401);
    });
});
