import jwt from 'jsonwebtoken';
import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const verify = async (ctx: Context) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);
    const authHeader = ctx.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Token verification attempt with missing or malformed auth header');
        ctx.status = 401;
        ctx.body = { success: false, message: 'Authorization header missing or malformed' };
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, config.get('jwtSecret')) as { aud?: string; username?: string; id?: string };
        if (payload.aud !== 'kivo') {
            logger.warn('Token verification failed: invalid audience', { audience: payload.aud });
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid or expired token' };
            return;
        }

        logger.info('Token verified successfully', { username: payload.username });
        ctx.body = { success: true, payload: { id: payload.id, username: payload.username } };
    } catch (error) {
        // Handle expected token expiration and invalid tokens without logging errors
        if (error instanceof jwt.TokenExpiredError) {
            logger.warn('Token verification failed: token expired');
            ctx.status = 401;
            ctx.body = { success: false, message: 'Token expired' };
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            logger.warn('Token verification failed: invalid token', {
                error: error.message,
            });
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid token' };
            return;
        }

        // Log unexpected errors
        logger.error('Error verifying token', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
