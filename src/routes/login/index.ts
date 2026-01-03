import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Context } from 'koa';
import { ObjectId } from 'mongodb';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

interface IUser {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const login = async (ctx: Context) => {
    const { username, password } = ctx.request.body as { username?: string; password?: string };
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!username || !password) {
        logger.warn('Login attempt with missing credentials', {
            username: username || 'missing',
            hasPassword: !!password,
        });
        ctx.status = 400;
        ctx.body = { success: false, message: 'Username and password are required' };
        return;
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const usersCollection = database.getCollection('users');

    const user = (await usersCollection.findOne({ username })) as IUser | null;

    if (!user) {
        logger.warn('Login attempt with non-existent user', { username });
        ctx.status = 401;
        ctx.body = { success: false, message: 'Invalid username or password' };
        return;
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        logger.warn('Login attempt with invalid password', { username });
        ctx.status = 401;
        ctx.body = { success: false, message: 'Invalid username or password' };
        return;
    }

    const config = dependencyContainer.resolve(DependencyToken.Config);
    const jwtSecret = config.get('jwtSecret');
    const accessTokenExpiry = config.get('accessTokenExpiry');
    const refreshTokenExpiry = config.get('refreshTokenExpiry');
    const secure = config.get('secure');
    const sameSite = config.get('sameSite');

    const tokenPayload = { sub: username, username, id: user._id.toString(), aud: 'kivo' };
    const accessToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: accessTokenExpiry } as jwt.SignOptions);
    const refreshToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: refreshTokenExpiry } as jwt.SignOptions);

    ctx.set('Cache-Control', 'no-store');
    ctx.set('Pragma', 'no-cache');

    const sessionsCollection = database.getCollection('sessions');
    const tokenHash = hashToken(refreshToken);
    await sessionsCollection.insertOne({ _id: new ObjectId(), username, tokenHash, createdAt: new Date() });

    logger.info('User login successful', { username, userId: user._id });

    ctx.cookies.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    ctx.body = {
        accessToken,
    };
};
