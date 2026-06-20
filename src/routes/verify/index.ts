import type { Context } from 'hono';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

export const verify = async (c: Context) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);
    const authHeader = c.req.header('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Token verification attempt with missing or malformed auth header');
        return c.json(
            {
                success: false,
                message: 'Authorization header missing or malformed',
            },
            401
        );
    }

    const token = authHeader.split(' ')[1];

    try {
        const { verify: jwtVerify } = await import('jsonwebtoken');
        // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
        const payload = jwtVerify(token, config.get('jwtSecret') as any) as {
            aud?: string;
            username?: string;
            id?: string;
        };

        if (payload.aud !== 'kivo') {
            logger.warn('Token verification failed: invalid audience', {
                audience: payload.aud,
            });
            return c.json({ success: false, message: 'Invalid or expired token' }, 401);
        }

        logger.info('Token verified successfully', {
            username: payload.username,
        });
        return c.json({
            success: true,
            payload: { id: payload.id, username: payload.username },
        });
    } catch (error) {
        const { TokenExpiredError, JsonWebTokenError } = await import('jsonwebtoken');

        if (error instanceof TokenExpiredError) {
            logger.warn('Token verification failed: token expired');
            return c.json({ success: false, message: 'Token expired' }, 401);
        }

        if (error instanceof JsonWebTokenError) {
            logger.warn('Token verification failed: invalid token', {
                error: (error as Error).message,
            });
            return c.json({ success: false, message: 'Invalid token' }, 401);
        }

        logger.error('Error verifying token', error);
        return c.json({ success: false, message: 'Internal server error' }, 500);
    }
};
