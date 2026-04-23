import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
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

// biome-ignore lint/suspicious/noExplicitAny: Elysia handler context requires any type
export const login = async ({ body, cookie, set }: any) => {
    const { username, password } = body as {
        username?: string;
        password?: string;
    };
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!username || !password) {
        logger.warn('Login attempt with missing credentials', {
            username: username || 'missing',
            hasPassword: !!password,
        });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'missing_credentials' });
        set.status = 400;
        return {
            success: false,
            message: 'Username and password are required',
        };
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const usersCollection = database.getCollection('users');

    const user = (await usersCollection.findOne({ username })) as IUser | null;

    if (!user) {
        logger.warn('Login attempt with non-existent user', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'unknown_user' });
        set.status = 401;
        return { success: false, message: 'Invalid username or password' };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        logger.warn('Login attempt with invalid password', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'invalid_password' });
        set.status = 401;
        return { success: false, message: 'Invalid username or password' };
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

    // Sign tokens using jsonwebtoken library directly (as Elysia JWT plugin is for verification)
    const { sign } = await import('jsonwebtoken');
    const accessToken = sign(tokenPayload, jwtSecret, {
        expiresIn: accessTokenExpiry,
    });
    const refreshToken = sign(tokenPayload, jwtSecret, {
        expiresIn: refreshTokenExpiry,
    });

    set.headers['Cache-Control'] = 'no-store';
    set.headers.Pragma = 'no-cache';

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

    // Set cookie with Elysia's cookie API
    cookie.refreshToken.set({
        value: refreshToken,
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 30 * 24 * 60 * 60, // seconds, not milliseconds like Koa
    });

    return {
        accessToken,
    };
};
