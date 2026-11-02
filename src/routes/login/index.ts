import type { Context } from 'hono';
import type { ObjectId } from 'mongodb';

import { dependencyContainer } from '../../dependencies.js';
import { createSession, issueTokens, noStore, setRefreshCookie } from '../../lib/auth/index.js';
import { hashPassword, isLegacyHash, verifyAgainstDummy, verifyPassword } from '../../lib/auth/password.js';
import { USERNAME_COLLATION } from '../../lib/database/init.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { authAttemptsTotal } from '../../lib/metrics.js';
import { credentialsSchema, readJsonBody } from '../../lib/validation.js';
import { clearFailedLogins, getLoginLockout, recordFailedLogin } from '../../middleware/loginThrottle.js';

interface IUser {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
}

export const login = async (c: Context) => {
    const { username, password } = await readJsonBody(c, credentialsSchema);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!username || !password) {
        logger.warn('Login attempt with missing credentials', {
            username: username || 'missing',
            hasPassword: !!password,
        });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'missing_credentials' });

        return c.json({ success: false, message: 'Username and password are required' }, 400);
    }

    const lockedFor = getLoginLockout(username);

    if (lockedFor !== undefined) {
        logger.warn('Login attempt on locked account', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'locked' });
        c.header('Retry-After', String(lockedFor));

        return c.json(
            { success: false, message: 'Too many failed attempts, try again later', retryAfter: lockedFor },
            429
        );
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const usersCollection = database.getCollection('users');

    const user: IUser | null = await usersCollection.findOne({ username }, { collation: USERNAME_COLLATION });

    if (!user) {
        await verifyAgainstDummy(password);
        recordFailedLogin(username);
        logger.warn('Login attempt with non-existent user', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'unknown_user' });

        return c.json({ success: false, message: 'Invalid username or password' }, 401);
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
        recordFailedLogin(username);
        logger.warn('Login attempt with invalid password', { username });
        authAttemptsTotal.inc({ endpoint: 'login', outcome: 'invalid_password' });

        return c.json({ success: false, message: 'Invalid username or password' }, 401);
    }

    clearFailedLogins(username);

    if (isLegacyHash(user.passwordHash)) {
        await usersCollection.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password) } });
    }

    const { accessToken, refreshToken } = issueTokens({
        username: user.username,
        id: user._id?.toString() ?? username,
    });

    noStore(c);
    await createSession(user.username, refreshToken);

    logger.info('User login successful', { username, userId: user._id });
    authAttemptsTotal.inc({ endpoint: 'login', outcome: 'success' });

    setRefreshCookie(c, refreshToken);

    return c.json({ success: true, accessToken });
};
