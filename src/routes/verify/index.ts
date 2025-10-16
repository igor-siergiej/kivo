import jwt from 'jsonwebtoken';
import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const verify = async (ctx: Context) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const authHeader = ctx.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.status = 401;
        ctx.body = { success: false, message: 'Authorization header missing or malformed' };
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, config.get('jwtSecret')) as { aud?: string };
        if (payload.aud !== 'kivo') {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid or expired token' };
            return;
        }

        ctx.body = { success: true, payload };
    } catch (error) {
        // Handle expected token expiration and invalid tokens without logging errors
        if (error instanceof jwt.TokenExpiredError) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Token expired' };
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid token' };
            return;
        }

        // Log unexpected errors
        const logger = dependencyContainer.resolve(DependencyToken.Logger);
        logger.error('Error verifying token', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
