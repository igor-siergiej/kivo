import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const refresh = async ({ cookie, set, request }: any) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    const jwtSecret = config.get('jwtSecret');
    const accessTokenExpiry = config.get('accessTokenExpiry');
    const refreshTokenExpiry = config.get('refreshTokenExpiry');
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');

    // In Elysia, cookies need to be read from headers
    const cookieHeader = request.headers.get('cookie') || '';
    const refreshTokenMatch = cookieHeader.match(/refreshToken=([^;]*)/);
    const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

    if (!refreshToken) {
        logger.warn('Token refresh attempt with missing refresh token');
        set.status = 400;
        return { success: false, message: 'refreshToken cookie missing' };
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
            set.status = 401;
            return { success: false, message: 'Invalid session' };
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
            logger.warn('Token refresh failed: session not found', {
                username,
            });
            set.status = 401;
            return { success: false, message: 'Invalid session' };
        }

        // Get user to include ID in tokens
        const usersCollection = database.getCollection('users');
        const user = await usersCollection.findOne({ username });

        if (!user) {
            logger.warn('Token refresh failed: user not found', { username });
            set.status = 401;
            return { success: false, message: 'Authentication failed' };
        }

        // Session valid – issue new tokens
        const { sign } = await import('jsonwebtoken');
        const newAccessToken = sign({ sub: username, username, id: user._id, aud: 'kivo' }, jwtSecret, {
            expiresIn: accessTokenExpiry,
        });
        const newRefreshToken = sign({ sub: username, username, id: user._id, aud: 'kivo' }, jwtSecret, {
            expiresIn: refreshTokenExpiry,
        });

        const newTokenHash = hashToken(newRefreshToken);

        // Store new session and delete old one atomically
        await sessionsCollection.insertOne({
            _id: new ObjectId(),
            username,
            tokenHash: newTokenHash,
            createdAt: new Date(),
        });
        await sessionsCollection.deleteOne({ _id: session._id });

        logger.info('Token refreshed successfully', { username });

        // Prevent caching of sensitive token response
        set.headers['Cache-Control'] = 'no-store';
        set.headers.Pragma = 'no-cache';

        // Set new refresh token cookie
        cookie.refreshToken.set({
            value: newRefreshToken,
            httpOnly: true,
            secure,
            sameSite,
            maxAge: 30 * 24 * 60 * 60, // seconds
        });

        return {
            accessToken: newAccessToken,
        };
    } catch (error) {
        // Handle expected token expiration separately from unexpected errors
        const { TokenExpiredError, JsonWebTokenError } = await import('jsonwebtoken');

        if (error instanceof TokenExpiredError) {
            logger.warn('Token refresh failed: refresh token expired');
            set.status = 403;
            return { success: false, message: 'Refresh token expired' };
        }

        if (error instanceof JsonWebTokenError) {
            logger.warn('Token refresh failed: invalid refresh token', {
                error: (error as Error).message,
            });
            set.status = 401;
            return { success: false, message: 'Invalid refresh token' };
        }

        // Log unexpected errors
        logger.error('Error refreshing token', error);
        set.status = 500;
        return { success: false, message: 'Internal server error' };
    }
};
