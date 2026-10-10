import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { dependencyContainer } from '../../dependencies.js';
import { clearRefreshCookie, hashToken, REFRESH_COOKIE } from '../../lib/auth/index.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

export const logout = async (c: Context) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!refreshToken) {
        logger.warn('Logout attempt with missing refresh token');
        return c.json({ success: false, message: 'refreshToken cookie missing' }, 400);
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const sessionsCollection = database.getCollection('sessions');

    const tokenHash = hashToken(refreshToken);
    const result = await sessionsCollection.deleteOne({ tokenHash });

    logger.info('User logout successful', {
        deletedSessionCount: result.deletedCount,
    });

    clearRefreshCookie(c);

    return c.json({ success: true });
};

/** Revokes every session of the user that owns the presented refresh token. */
export const logoutAll = async (c: Context) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!refreshToken) {
        return c.json({ success: false, message: 'refreshToken cookie missing' }, 400);
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const sessionsCollection = database.getCollection('sessions');

    const session = await sessionsCollection.findOne({ tokenHash: hashToken(refreshToken) });
    if (!session) {
        clearRefreshCookie(c);
        return c.json({ success: false, message: 'Invalid session' }, 401);
    }

    const result = await sessionsCollection.deleteMany({ username: session.username });
    logger.info('User logged out of all sessions', {
        username: session.username,
        deletedSessionCount: result.deletedCount,
    });

    clearRefreshCookie(c);
    return c.json({ success: true, revoked: result.deletedCount });
};
