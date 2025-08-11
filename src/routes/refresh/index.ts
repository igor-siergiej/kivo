import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Context } from 'koa';
import { ObjectId } from 'mongodb';

import { IConfig } from '../../lib/config/types';
import { CollectionName, Session, User } from '../../lib/database/types';
import { DependencyContainer } from '../../lib/dependencyContainer';
import { DependencyToken } from '../../lib/dependencyContainer/types';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const refresh = async (ctx: Context) => {
    const { jwtSecret, accessTokenExpiry, refreshTokenExpiry, secure, sameSite } = DependencyContainer.getInstance().resolve(DependencyToken.Config) as IConfig;

    const refreshToken = ctx.cookies.get('refreshToken');

    if (!refreshToken) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'refreshToken cookie missing' };
        return;
    }

    try {
        const payload = jwt.verify(refreshToken, jwtSecret) as { sub: string; aud?: string };
        if (payload.aud !== 'auth-service') {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid session' };
            return;
        }
        const username = payload.sub;

        const database = DependencyContainer.getInstance().resolve(DependencyToken.Database)!;
        const sessionsCollection = database.getCollection<Session>(CollectionName.Sessions);

        const tokenHash = hashToken(refreshToken);

        const session = await sessionsCollection.findOne({ tokenHash, username });

        if (!session) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid session' };
            return;
        }

        // Get user to include ID in tokens
        const usersCollection = database.getCollection<User>(CollectionName.Users);
        const user = await usersCollection.findOne({ username });

        if (!user) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Authentication failed' };
            return;
        }

        // Session valid – issue new tokens
        const signOptsAccess = { expiresIn: accessTokenExpiry } as SignOptions;
        const signOptsRefresh = { expiresIn: refreshTokenExpiry } as SignOptions;

        const newAccessToken = jwt.sign({ sub: username, username, id: user._id, aud: 'auth-service' }, jwtSecret, signOptsAccess);
        const newRefreshToken = jwt.sign({ sub: username, username, id: user._id, aud: 'auth-service' }, jwtSecret, signOptsRefresh);

        const newTokenHash = hashToken(newRefreshToken);

        // Store new session and delete old one atomically
        await sessionsCollection.insertOne({ _id: new ObjectId(), username, tokenHash: newTokenHash, createdAt: new Date() });
        await sessionsCollection.deleteOne({ _id: session._id });

        // Prevent caching of sensitive token response
        ctx.set('Cache-Control', 'no-store');
        ctx.set('Pragma', 'no-cache');

        // Set new refresh token cookie
        ctx.cookies.set('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        ctx.body = {
            accessToken: newAccessToken
        };
    } catch (error) {
        console.error('Error refreshing token', error);
        ctx.status = 401;
        ctx.body = { success: false, message: 'Invalid or expired refresh token' };
    }
};
