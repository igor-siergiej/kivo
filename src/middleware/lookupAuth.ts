import crypto from 'node:crypto';
import type { Context, Next } from 'hono';
import { dependencyContainer } from '../dependencies.js';
import { verifyToken } from '../lib/auth/index.js';
import { DependencyToken } from '../lib/dependencyContainer/types.js';

const safeEqual = (a: string, b: string) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const hasValidAccessToken = (c: Context, secret: string) => {
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) return false;

    try {
        return verifyToken(header.slice('Bearer '.length), secret).tokenType === 'access';
    } catch {
        return false;
    }
};

/**
 * Guards the user lookup endpoints. Off by default so existing consumers keep working until
 * they send credentials; enable with LOOKUP_AUTH_ENABLED=true.
 */
export const requireLookupAuth = (options: { allowServiceToken: boolean }) => async (c: Context, next: Next) => {
    const config = dependencyContainer.resolve(DependencyToken.Config);
    if (!config.get('lookupAuthEnabled')) return next();

    const serviceToken = config.get('serviceToken');
    const presented = c.req.header('x-service-token');
    const serviceTokenValid =
        options.allowServiceToken && !!serviceToken && !!presented && safeEqual(presented, serviceToken);

    if (serviceTokenValid || hasValidAccessToken(c, config.get('jwtSecret'))) return next();

    return c.json({ success: false, message: 'Authentication required' }, 401);
};
