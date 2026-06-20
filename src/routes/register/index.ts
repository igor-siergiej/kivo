import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { registrationsTotal } from '../../lib/metrics.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const register = async (c: Context) => {
    const body = await c.req.json<{ username?: string; password?: string }>();
    const { username, password } = body;
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!username || !password) {
        logger.warn('Registration attempt with missing credentials', {
            username: username || 'missing',
            hasPassword: !!password,
        });
        registrationsTotal.inc({ outcome: 'missing_credentials' });
        return c.json({ success: false, message: 'Username and password are required' }, 400);
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
        logger.warn('Registration attempt with weak password', { username });
        registrationsTotal.inc({ outcome: 'weak_password' });
        return c.json({ success: false, message: 'Password too weak' }, 400);
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
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

    const usersCollection = database.getCollection('users');

    const existing = await usersCollection.findOne({ username });
    if (existing) {
        logger.warn('Registration attempt with existing username', { username });
        registrationsTotal.inc({ outcome: 'username_taken' });
        return c.json({ success: false, message: 'This username is already taken' }, 400);
    }

    try {
        const saltRounds = 14;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const result = await usersCollection.insertOne({
            _id: new ObjectId(),
            username,
            passwordHash,
        });

        const { sign } = await import('jsonwebtoken');
        const tokenPayload = {
            sub: username,
            username,
            id: result.insertedId,
            aud: 'kivo',
        };
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

        logger.info('User registration successful', {
            username,
            userId: result.insertedId,
        });
        registrationsTotal.inc({ outcome: 'success' });

        setCookie(c, 'refreshToken', refreshToken, {
            httpOnly: true,
            secure,
            sameSite,
            maxAge: 30 * 24 * 60 * 60,
        });

        return c.json({ accessToken });
    } catch (error) {
        logger.error('User registration failed', {
            username,
            error: error instanceof Error ? error.message : String(error),
        });
        registrationsTotal.inc({ outcome: 'error' });
        return c.json({ success: false, message: 'Registration failed. Please try again.' }, 500);
    }
};
