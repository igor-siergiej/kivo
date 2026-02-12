import crypto from 'node:crypto';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const logout = async ({ cookie, set, request }: any) => {
    // In Elysia, cookies need to be read from headers
    const cookieHeader = request.headers.get('cookie') || '';
    const refreshTokenMatch = cookieHeader.match(/refreshToken=([^;]*)/);
    const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!refreshToken) {
        logger.warn('Logout attempt with missing refresh token');
        set.status = 400;
        return { success: false, message: 'refreshToken cookie missing' };
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');
    const sessionsCollection = database.getCollection('sessions');

    const tokenHash = hashToken(refreshToken);

    const result = await sessionsCollection.deleteOne({ tokenHash });

    logger.info('User logout successful', {
        deletedSessionCount: result.deletedCount,
    });

    // Clear refresh token cookie
    cookie.refreshToken.set({
        value: '',
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 0,
    });

    return { success: true };
};
