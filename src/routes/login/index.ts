import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { authAttemptsTotal } from '../../lib/metrics.js';

interface IUser {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const login = async (c: Context) => {
    const body = await c.req.json<{ username?: string; password?: string }>();
    const { username, password } = body;
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!username || !password) {
        logger.warn('Login attempt with missing credentials', {
            username: username || 'missing',
            hasPassword: !!password,
        });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'missing_credentials' });
        return c.json({ success: false, message: 'Username and password are required' }, 400);
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const usersCollection = database.getCollection('users');

    const user = (await usersCollection.findOne({ username })) as IUser | null;

    if (!user) {
        logger.warn('Login attempt with non-existent user', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'unknown_user' });
        return c.json({ success: false, message: 'Invalid username or password' }, 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        logger.warn('Login attempt with invalid password', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'invalid_password' });
        return c.json({ success: false, message: 'Invalid username or password' }, 401);
    }

    const config = dependencyContainer.resolve(DependencyToken.Config);
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const jwtSecret = config.get('jwtSecret') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const accessTokenExpiry = config.get('accessTokenExpiry') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const refreshTokenExpiry = config.get('refreshTokenExpiry') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const secure = config.get('secure') as any;
    // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
    const sameSite = config.get('sameSite') as any;

    const tokenPayload = {
        sub: username,
        username,
        id: user._id?.toString() || username,
        aud: 'kivo',
    };

    const { sign } = await import('jsonwebtoken');
    const accessToken = sign(tokenPayload, jwtSecret, {
        expiresIn: accessTokenExpiry,
    });
    const refreshToken = sign(tokenPayload, jwtSecret, {
        expiresIn: refreshTokenExpiry,
    });

    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    const sessionsCollection = database.getCollection('sessions');
    const tokenHash = hashToken(refreshToken);
    await sessionsCollection.insertOne({
        _id: new ObjectId(),
        username,
        tokenHash,
        createdAt: new Date(),
    });

    logger.info('User login successful', { username, userId: user._id });
    authAttemptsTotal.inc({ endpoint: 'login', outcome: 'success' });

    setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 30 * 24 * 60 * 60,
    });

    return c.json({ accessToken });
};
