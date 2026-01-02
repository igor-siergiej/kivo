import jwt from 'jsonwebtoken';
import type { Context, Next } from 'koa';

import { dependencyContainer } from '../dependencies';
import { DependencyToken } from '../lib/dependencyContainer/types';

/**
 * Authentication middleware that verifies JWT tokens
 * Extracts token from Authorization: Bearer <token> header
 */
export const authenticate = async (ctx: Context, next: Next) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);
    const authHeader = ctx.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Authentication attempt with missing or malformed auth header', {
            path: ctx.path,
        });
        ctx.status = 401;
        ctx.body = { success: false, message: 'Authorization header missing or malformed' };
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, config.get('jwtSecret')) as { aud?: string; username?: string; id?: string };
        if (payload.aud !== 'kivo') {
            logger.warn('Authentication failed: invalid audience', { audience: payload.aud, path: ctx.path });
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid token' };
            return;
        }

        // Attach user info to context for downstream handlers
        ctx.state.user = { username: payload.username, id: payload.id };
        logger.debug('Authentication successful', { username: payload.username, path: ctx.path });
        await next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            logger.warn('Authentication failed: token expired', { path: ctx.path });
            ctx.status = 401;
            ctx.body = { success: false, message: 'Token expired' };
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            logger.warn('Authentication failed: invalid token', { error: error.message, path: ctx.path });
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid token' };
            return;
        }

        logger.error('Error authenticating token', { error, path: ctx.path });
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
