import crypto from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { sign } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../dependencyContainer/types.js';

export const REFRESH_COOKIE = 'refreshToken';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const issueTokens = (user: { username: string; id: string }) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const payload = { sub: user.username, username: user.username, id: user.id, aud: 'kivo' };
    const secret = config.get('jwtSecret');

    return {
        accessToken: sign(payload, secret, { expiresIn: config.get('accessTokenExpiry') }),
        refreshToken: sign(payload, secret, { expiresIn: config.get('refreshTokenExpiry') }),
    };
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
