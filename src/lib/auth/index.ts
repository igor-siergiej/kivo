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

export const createSession = async (username: string, refreshToken: string) => {
    const database = dependencyContainer.resolve(DependencyToken.Database);
    await database.getCollection('sessions').insertOne({
        _id: new ObjectId(),
        username,
        tokenHash: hashToken(refreshToken),
        createdAt: new Date(),
    });
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
