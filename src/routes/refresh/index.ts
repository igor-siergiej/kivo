import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Context } from 'koa';
import { ObjectId } from 'mongodb';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const refresh = async (ctx: Context) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const jwtSecret = config.get('jwtSecret');
    const accessTokenExpiry = config.get('accessTokenExpiry');
    const refreshTokenExpiry = config.get('refreshTokenExpiry');
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');

    const refreshToken = ctx.cookies.get('refreshToken');

    if (!refreshToken) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'refreshToken cookie missing' };
        return;
    }

    try {
        const payload = jwt.verify(refreshToken, jwtSecret) as { sub: string; aud?: string };
        if (payload.aud !== 'kivo') {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid session' };
            return;
        }
        const username = payload.sub;

        const database = dependencyContainer.resolve(DependencyToken.Database);
        const sessionsCollection = database.getCollection('sessions');

        const tokenHash = hashToken(refreshToken);

        const session = await sessionsCollection.findOne({ tokenHash, username });

        if (!session) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid session' };
            return;
        }

        // Get user to include ID in tokens
        const usersCollection = database.getCollection('users');
        const user = await usersCollection.findOne({ username });

        if (!user) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Authentication failed' };
            return;
        }

        // Session valid – issue new tokens
        const signOptsAccess = { expiresIn: accessTokenExpiry } as SignOptions;
        const signOptsRefresh = { expiresIn: refreshTokenExpiry } as SignOptions;

        const newAccessToken = jwt.sign(
            { sub: username, username, id: user._id, aud: 'kivo' },
            jwtSecret,
            signOptsAccess
        );
        const newRefreshToken = jwt.sign(
            { sub: username, username, id: user._id, aud: 'kivo' },
            jwtSecret,
            signOptsRefresh
        );

        const newTokenHash = hashToken(newRefreshToken);

        // Store new session and delete old one atomically
        await sessionsCollection.insertOne({
            _id: new ObjectId(),
            username,
            tokenHash: newTokenHash,
            createdAt: new Date(),
        });
        await sessionsCollection.deleteOne({ _id: session._id });

        // Prevent caching of sensitive token response
        ctx.set('Cache-Control', 'no-store');
        ctx.set('Pragma', 'no-cache');

        // Set new refresh token cookie
        ctx.cookies.set('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        ctx.body = {
            accessToken: newAccessToken,
        };
    } catch (error) {
        // Handle expected token expiration separately from unexpected errors
        if (error instanceof jwt.TokenExpiredError) {
            ctx.status = 403;
            ctx.body = { success: false, message: 'Refresh token expired' };
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid refresh token' };
            return;
        }

        // Log unexpected errors
        const logger = dependencyContainer.resolve(DependencyToken.Logger);
        logger.error('Error refreshing token', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
