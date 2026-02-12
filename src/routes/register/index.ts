import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const register = async ({ body, cookie, set }: any) => {
    const { username, password } = body as {
        username?: string;
        password?: string;
    };
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!username || !password) {
        logger.warn('Registration attempt with missing credentials', {
            username: username || 'missing',
            hasPassword: !!password,
        });
        set.status = 400;
        return { success: false, message: 'Username and password are required' };
    }

    // Simple password strength check (at least 8 chars incl num/letter)
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
        logger.warn('Registration attempt with weak password', { username });
        set.status = 400;
        return { success: false, message: 'Password too weak' };
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const config = dependencyContainer.resolve(DependencyToken.Config);
    const jwtSecret = config.get('jwtSecret');
    const accessTokenExpiry = config.get('accessTokenExpiry');
    const refreshTokenExpiry = config.get('refreshTokenExpiry');
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');

    const usersCollection = database.getCollection('users');

    const existing = await usersCollection.findOne({ username });
    if (existing) {
        logger.warn('Registration attempt with existing username', { username });
        set.status = 400;
        return { success: false, message: 'This username is already taken' };
    }

    try {
        const saltRounds = 14;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const result = await usersCollection.insertOne({
            _id: new ObjectId(),
            username,
            passwordHash,
        });

        // Generate tokens
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

        // Prevent caching of tokens
        set.headers['Cache-Control'] = 'no-store';
        set.headers.Pragma = 'no-cache';

        // Save session with hashed refresh token
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

        // Set cookie
        cookie.refreshToken.set({
            value: refreshToken,
            httpOnly: true,
            secure,
            sameSite,
            maxAge: 30 * 24 * 60 * 60, // seconds
        });

        return {
            accessToken,
        };
    } catch (error) {
        logger.error('User registration failed', {
            username,
            error: error instanceof Error ? error.message : String(error),
        });
        set.status = 500;
        return {
            success: false,
            message: 'Registration failed. Please try again.',
        };
    }
};
