import crypto from 'node:crypto';
import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const logout = async (ctx: Context) => {
    const refreshToken = ctx.cookies.get('refreshToken');
    if (!refreshToken) {
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

    await sessionsCollection.deleteOne({ tokenHash });

    // Clear refresh token cookie
    ctx.cookies.set('refreshToken', '', {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 0,
    });

    ctx.body = { success: true };
};
