import crypto from 'node:crypto';
import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const logout = async (ctx: Context) => {
    const refreshToken = ctx.cookies.get('refreshToken');
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!refreshToken) {
        logger.warn('Logout attempt with missing refresh token');
        ctx.status = 400;
        ctx.body = { success: false, message: 'refreshToken cookie missing' };
        return;
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');
    const sessionsCollection = database.getCollection('sessions');

    const tokenHash = hashToken(refreshToken);

    const result = await sessionsCollection.deleteOne({ tokenHash });

    logger.info('User logout successful', { deletedSessionCount: result.deletedCount });

    // Clear refresh token cookie
    ctx.cookies.set('refreshToken', '', {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 0,
    });

    ctx.body = { success: true };
};
