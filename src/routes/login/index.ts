import bcrypt from 'bcryptjs';
import type { Context } from 'hono';
import type { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { createSession, issueTokens, noStore, setRefreshCookie } from '../../lib/auth/index.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { authAttemptsTotal } from '../../lib/metrics.js';
import { MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH, readJsonObject, stringField } from '../../lib/validation.js';

interface IUser {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
}

export const login = async (c: Context) => {
    const body = await readJsonObject(c);
    const username = stringField(body, 'username', MAX_USERNAME_LENGTH);
    const password = stringField(body, 'password', MAX_PASSWORD_LENGTH);
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

    const { accessToken, refreshToken } = issueTokens({ username, id: user._id?.toString() ?? username });

    noStore(c);
    await createSession(username, refreshToken);

    logger.info('User login successful', { username, userId: user._id });
    authAttemptsTotal.inc({ endpoint: 'login', outcome: 'success' });

    setRefreshCookie(c, refreshToken);

    return c.json({ accessToken });
};
