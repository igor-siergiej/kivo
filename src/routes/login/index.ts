import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Context } from 'koa';
import { ObjectId } from 'mongodb';

import { IConfig } from '../../lib/config/types';
import { CollectionName, Session, User } from '../../lib/database/types';
import { DependencyContainer } from '../../lib/dependencyContainer';
import { DependencyToken } from '../../lib/dependencyContainer/types';

interface IUser {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const login = async (ctx: Context) => {
    const { username, password } = ctx.request.body as { username?: string; password?: string };

    if (!username || !password) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Username and password are required' };
        return;
    }

    const database = DependencyContainer.getInstance().resolve(DependencyToken.Database)!;
    const usersCollection = database.getCollection<User>(CollectionName.Users);

    const user = (await usersCollection.findOne({ username })) as IUser | null;

    if (!user) {
        ctx.status = 401;
        ctx.body = { success: false, message: 'Invalid username or password' };
        return;
    } else {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            ctx.status = 401;
            ctx.body = { success: false, message: 'Invalid username or password' };
            return;
        }
    }

    const { jwtSecret, accessTokenExpiry, refreshTokenExpiry, secure, sameSite } = DependencyContainer.getInstance().resolve(DependencyToken.Config) as IConfig;

    const tokenPayload = { sub: username, username, id: user._id, aud: 'auth-service' };
    const accessToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: accessTokenExpiry } as jwt.SignOptions);
    const refreshToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: refreshTokenExpiry } as jwt.SignOptions);

    // Prevent proxies or browsers from caching the tokens
    ctx.set('Cache-Control', 'no-store');
    ctx.set('Pragma', 'no-cache');

    // Save session (hashed refresh token)
    const sessionsCollection = database.getCollection<Session>(CollectionName.Sessions);
    const tokenHash = hashToken(refreshToken);
    await sessionsCollection.insertOne({ _id: new ObjectId(), username, tokenHash, createdAt: new Date() });

    // Store refresh token in secure, httpOnly cookie (30 days)
    ctx.cookies.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    ctx.body = {
        accessToken
    };
};
