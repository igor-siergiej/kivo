import crypto from 'node:crypto';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const refresh = async (c: Context) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const jwtSecret = config.get('jwtSecret') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const accessTokenExpiry = config.get('accessTokenExpiry') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const refreshTokenExpiry = config.get('refreshTokenExpiry') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const secure = config.get('secure') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const sameSite = config.get('sameSite') as any;

    const refreshToken = getCookie(c, 'refreshToken');

    if (!refreshToken) {
        logger.warn('Token refresh attempt with missing refresh token');
        return c.json({ success: false, message: 'refreshToken cookie missing' }, 400);
    }

    try {
        const { verify } = await import('jsonwebtoken');
        const payload = verify(refreshToken, jwtSecret) as {
            sub: string;
            aud?: string;
        };

        if (payload.aud !== 'kivo') {
            logger.warn('Token refresh failed: invalid audience', {
                audience: payload.aud,
            });
            return c.json({ success: false, message: 'Invalid session' }, 401);
        }

        const username = payload.sub;

        const database = dependencyContainer.resolve(DependencyToken.Database);
        const sessionsCollection = database.getCollection('sessions');

        const tokenHash = hashToken(refreshToken);

        const session = await sessionsCollection.findOne({
            tokenHash,
            username,
        });

        if (!session) {
            logger.warn('Token refresh failed: session not found', { username });
            return c.json({ success: false, message: 'Invalid session' }, 401);
        }

        const usersCollection = database.getCollection('users');
        const user = await usersCollection.findOne({ username });

        if (!user) {
            logger.warn('Token refresh failed: user not found', { username });
            return c.json({ success: false, message: 'Authentication failed' }, 401);
        }

        const { sign } = await import('jsonwebtoken');
        const newAccessToken = sign({ sub: username, username, id: user._id, aud: 'kivo' }, jwtSecret, {
            expiresIn: accessTokenExpiry,
        });
        const newRefreshToken = sign({ sub: username, username, id: user._id, aud: 'kivo' }, jwtSecret, {
            expiresIn: refreshTokenExpiry,
        });

        const newTokenHash = hashToken(newRefreshToken);

        await sessionsCollection.insertOne({
            _id: new ObjectId(),
            username,
            tokenHash: newTokenHash,
            createdAt: new Date(),
        });
        await sessionsCollection.deleteOne({ _id: session._id });

        logger.info('Token refreshed successfully', { username });

        c.header('Cache-Control', 'no-store');
        c.header('Pragma', 'no-cache');

        setCookie(c, 'refreshToken', newRefreshToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: 30 * 24 * 60 * 60,
        });

        return c.json({ accessToken: newAccessToken });
    } catch (error) {
        const { TokenExpiredError, JsonWebTokenError } = await import('jsonwebtoken');

        if (error instanceof TokenExpiredError) {
            logger.warn('Token refresh failed: refresh token expired');
            return c.json({ success: false, message: 'Refresh token expired' }, 403);
        }

        if (error instanceof JsonWebTokenError) {
            logger.warn('Token refresh failed: invalid refresh token', {
                error: (error as Error).message,
            });
            return c.json({ success: false, message: 'Invalid refresh token' }, 401);
        }

        logger.error('Error refreshing token', error);
        return c.json({ success: false, message: 'Internal server error' }, 500);
    }
};
