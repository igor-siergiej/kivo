import crypto from 'crypto';
import { Context } from 'koa';

import { IConfig } from '../../lib/config/types';
import { CollectionName, Session } from '../../lib/database/types';
import { DependencyContainer } from '../../lib/dependencyContainer';
import { DependencyToken } from '../../lib/dependencyContainer/types';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const logout = async (ctx: Context) => {
    const refreshToken = ctx.cookies.get('refreshToken');
    if (!refreshToken) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'refreshToken cookie missing' };
        return;
    }

    const container = DependencyContainer.getInstance();
    const database = container.resolve(DependencyToken.Database)!;
    const { secure, sameSite } = container.resolve(DependencyToken.Config) as IConfig;
    const sessionsCollection = database.getCollection<Session>(CollectionName.Sessions);

    const tokenHash = hashToken(refreshToken);

    await sessionsCollection.deleteOne({ tokenHash });

    // Clear refresh token cookie
    ctx.cookies.set('refreshToken', '', {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 0
    });

    ctx.body = { success: true };
};
