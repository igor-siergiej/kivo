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
        ctx.body = { success: true, users: [] };
        return;
    }

    const database = dependencyContainer.resolve(DependencyToken.Database);
    const usersCollection = database.getCollection('users');

    try {
        const users = await usersCollection
            .find({ username: { $in: usernames } })
            .project({ username: 1, _id: 1 })
            .toArray();

        logger.info('Users retrieved successfully', {
            requestedCount: usernames.length,
            foundCount: users.length,
            usernames: users.map((u) => u.username),
        });

        ctx.body = {
            success: true,
            users: users.map((user) => ({
                id: user._id.toString(),
                username: user.username,
            })),
        };
    } catch (error) {
        logger.error('Error fetching users', {
            requestedUsernames: usernames,
            error,
        });
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
