import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const getUsersByUsernames = async (ctx: Context) => {
    const { usernames } = ctx.request.body as { usernames?: Array<string> };
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!usernames || !Array.isArray(usernames)) {
        logger.warn('Get users request with invalid usernames format', {
            receivedType: Array.isArray(usernames) ? 'array' : typeof usernames,
        });
        ctx.status = 400;
        ctx.body = { success: false, message: 'usernames array is required' };
        return;
    }

    if (usernames.length === 0) {
        logger.info('Get users request with empty usernames array');
        ctx.status = 200;
        ctx.body = { success: true, users: [] };
        return;
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);

    if (!database) {
        logger.error('Database service not available');
        ctx.status = 503;
        ctx.body = { success: false, message: 'Service unavailable' };
        return;
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
            usernames: foundUsernames,
            notFoundUsernames,
        });

        ctx.body = {
            success: true,
            users: users.map((user) => ({
                id: user._id.toString(),
                username: user.username,
            })),
            notFoundUsernames,
        };
    } catch (error) {
        logger.error('Error fetching users', {
            requestedUsernames: usernames,
            error: error instanceof Error ? error.message : String(error),
        });
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error', notFoundUsernames: [] };
    }
};
