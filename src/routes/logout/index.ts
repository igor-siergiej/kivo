import crypto from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const logout = async (c: Context) => {
    const refreshToken = getCookie(c, 'refreshToken');
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!refreshToken) {
        logger.warn('Logout attempt with missing refresh token');
        return c.json({ success: false, message: 'refreshToken cookie missing' }, 400);
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const config = dependencyContainer.resolve(DependencyToken.Config);
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const secure = config.get('secure') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const sameSite = config.get('sameSite') as any;
    const sessionsCollection = database.getCollection('sessions');

    const tokenHash = hashToken(refreshToken);
    const result = await sessionsCollection.deleteOne({ tokenHash });

    logger.info('User logout successful', {
        deletedSessionCount: result.deletedCount,
    });

    deleteCookie(c, 'refreshToken', {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 0,
    });

    return c.json({ success: true });
};
