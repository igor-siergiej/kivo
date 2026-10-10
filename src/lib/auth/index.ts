import crypto from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { type JwtPayload, sign, verify } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../dependencyContainer/types.js';

export const REFRESH_COOKIE = 'refreshToken';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type TokenType = 'access' | 'refresh';

const ALGORITHM = 'HS256';
const ISSUER = 'kivo';

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const issueTokens = (user: { username: string; id: string }) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const payload = { sub: user.username, username: user.username, id: user.id, aud: 'kivo' };
    const secret = config.get('jwtSecret');
    const options = { algorithm: ALGORITHM, issuer: ISSUER } as const;

    return {
        accessToken: sign({ ...payload, tokenType: 'access' }, secret, {
            ...options,
            expiresIn: config.get('accessTokenExpiry'),
        }),
        // jti keeps rotated refresh tokens unique even when issued within the same second
        refreshToken: sign({ ...payload, tokenType: 'refresh' }, secret, {
            ...options,
            expiresIn: config.get('refreshTokenExpiry'),
            jwtid: crypto.randomUUID(),
        }),
    };
};

/** Verifies signature, expiry and audience. Throws jsonwebtoken errors on failure. */
export const verifyToken = (token: string, secret: string): JwtPayload & { tokenType?: TokenType } => {
    const payload = verify(token, secret, { algorithms: [ALGORITHM], audience: 'kivo' });
    if (typeof payload === 'string') {
        throw new Error('Unexpected string token payload');
    }
    return payload;
};

export const MAX_SESSIONS_PER_USER = 10;
// Tolerates a client firing two refreshes at once (two tabs) without treating it as token theft
export const ROTATION_GRACE_MS = 10_000;

export const createSession = async (username: string, refreshToken: string, familyId = new ObjectId().toString()) => {
    const database = dependencyContainer.resolve(DependencyToken.Database);
    const sessions = database.getCollection('sessions');

    await sessions.insertOne({
        _id: new ObjectId(),
        username,
        tokenHash: hashToken(refreshToken),
        createdAt: new Date(),
        familyId,
    });

    const active = await sessions.find({ username, rotatedAt: { $exists: false } }).toArray();
    if (active.length > MAX_SESSIONS_PER_USER) {
        const oldest = [...active]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .slice(0, active.length - MAX_SESSIONS_PER_USER);
        await sessions.deleteMany({ _id: { $in: oldest.map((session) => session._id) } });
    }
};

const cookieOptions = () => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    return { httpOnly: true, secure: config.get('secure'), sameSite: config.get('sameSite') } as const;
};

export const setRefreshCookie = (c: Context, refreshToken: string) =>
    setCookie(c, REFRESH_COOKIE, refreshToken, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE_SECONDS });

export const clearRefreshCookie = (c: Context) => deleteCookie(c, REFRESH_COOKIE, { ...cookieOptions(), maxAge: 0 });

export const noStore = (c: Context) => {
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
};
