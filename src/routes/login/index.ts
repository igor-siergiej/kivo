import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

interface IUser {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

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
        set.status = 401;
        return { success: false, message: 'Invalid username or password' };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        logger.warn('Login attempt with invalid password', { username });
        set.status = 401;
        return { success: false, message: 'Invalid username or password' };
    }

    const config = dependencyContainer.resolve(DependencyToken.Config);
    const jwtSecret = config.get('jwtSecret');
    const accessTokenExpiry = config.get('accessTokenExpiry');
    const refreshTokenExpiry = config.get('refreshTokenExpiry');
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');

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
