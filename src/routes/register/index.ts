import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Context } from 'koa';
import { ObjectId } from 'mongodb';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const register = async (ctx: Context) => {
    const { username, password } = ctx.request.body as { username?: string; password?: string };

    if (!username || !password) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Username and password are required' };
        return;
    }

    // TODO: move this to use an acutal library or something
    // Simple password strength check (at least 8 chars incl num/letter)
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Password too weak' };
        return;
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
        ctx.status = 400;
        ctx.body = { success: false, message: 'This username is already taken' };
        return;
    }

    const saltRounds = 14;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const result = await usersCollection.insertOne({ _id: new ObjectId(), username, passwordHash });

    // generate tokens
    const tokenPayload = { sub: username, username, id: result.insertedId, aud: 'kivo' };
    const accessToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: accessTokenExpiry } as SignOptions);
    const refreshToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: refreshTokenExpiry } as SignOptions);

    // Prevent caching of tokens
    ctx.set('Cache-Control', 'no-store');
    ctx.set('Pragma', 'no-cache');

    // Save session with hashed refresh token
    const sessionsCollection = database.getCollection('sessions');
    const tokenHash = hashToken(refreshToken);
    await sessionsCollection.insertOne({ _id: new ObjectId(), username, tokenHash, createdAt: new Date() });

    // Set cookie
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
