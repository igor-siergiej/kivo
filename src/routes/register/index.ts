import bcrypt from 'bcryptjs';
import type { Context } from 'hono';
import { ObjectId } from 'mongodb';
import { dependencyContainer } from '../../dependencies.js';
import { createSession, issueTokens, noStore, setRefreshCookie } from '../../lib/auth/index.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { registrationsTotal } from '../../lib/metrics.js';
import { MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH, readJsonObject, stringField } from '../../lib/validation.js';

export const register = async (c: Context) => {
    const body = await readJsonObject(c);
    const username = stringField(body, 'username', MAX_USERNAME_LENGTH);
    const password = stringField(body, 'password', MAX_PASSWORD_LENGTH);
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

        const { accessToken, refreshToken } = issueTokens({ username, id: result.insertedId.toString() });

        noStore(c);
        await createSession(username, refreshToken);

        logger.info('User registration successful', {
            username,
            userId: result.insertedId,
        });
        registrationsTotal.inc({ outcome: 'success' });

        setRefreshCookie(c, refreshToken);

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
