import type { Context } from 'hono';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { MAX_USERNAME_LENGTH, MAX_USERNAMES_PER_REQUEST, readJsonObject } from '../../lib/validation.js';

export const getUsersByUsernames = async (c: Context) => {
    const body = await readJsonObject(c);
    const { usernames } = body;
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (
        !Array.isArray(usernames) ||
        usernames.length > MAX_USERNAMES_PER_REQUEST ||
        !usernames.every((name) => typeof name === 'string' && name.length <= MAX_USERNAME_LENGTH)
    ) {
        logger.warn('Get users request with invalid usernames format', {
            receivedType: Array.isArray(usernames) ? 'array' : typeof usernames,
        });
        return c.json(
            { success: false, message: `usernames must be an array of up to ${MAX_USERNAMES_PER_REQUEST} strings` },
            400
        );
    }

    if (usernames.length === 0) {
        logger.info('Get users request with empty usernames array');
        return c.json({ success: true, users: [] });
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);

    if (!database) {
        logger.error('Database service not available');
        return c.json({ success: false, message: 'Service unavailable' }, 503);
    }

    const usersCollection = database.getCollection('users');

    try {
        const users = await usersCollection
            .find({ username: { $in: usernames } })
            .project({ username: 1, _id: 1 })
            .toArray();

        const foundUsernames = users.map((u) => u.username);
        const notFoundUsernames = usernames.filter((u) => !foundUsernames.includes(u));

        logger.info('Users retrieved successfully', {
            requestedCount: usernames.length,
            foundCount: users.length,
            notFoundCount: notFoundUsernames.length,
        });

        return c.json({
            success: true,
            users: users.map((user) => ({
                id: user._id.toString(),
                username: user.username,
            })),
            notFoundUsernames,
        });
    } catch (error) {
        logger.error('Error fetching users', {
            requestedCount: usernames.length,
            error: error instanceof Error ? error.message : String(error),
        });
        return c.json(
            {
                success: false,
                message: 'Internal server error',
                notFoundUsernames: [],
            },
            500
        );
    }
};
