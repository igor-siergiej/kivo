import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { JsonWebTokenError, TokenExpiredError, verify } from 'jsonwebtoken';
import { dependencyContainer } from '../../dependencies.js';
import {
    createSession,
    hashToken,
    issueTokens,
    noStore,
    REFRESH_COOKIE,
    setRefreshCookie,
} from '../../lib/auth/index.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

export const refresh = async (c: Context) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    const jwtSecret = config.get('jwtSecret');

    const refreshToken = getCookie(c, REFRESH_COOKIE);

    if (!refreshToken) {
        logger.warn('Token refresh attempt with missing refresh token');
        return c.json({ success: false, message: 'refreshToken cookie missing' }, 400);
    }

    try {
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

        const { accessToken, refreshToken: newRefreshToken } = issueTokens({ username, id: user._id.toString() });

        await createSession(username, newRefreshToken);
        await sessionsCollection.deleteOne({ _id: session._id });

        logger.info('Token refreshed successfully', { username });

        noStore(c);
        setRefreshCookie(c, newRefreshToken);

        return c.json({ accessToken });
    } catch (error) {
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
