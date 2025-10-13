import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const getUsersByUsernames = async (ctx: Context) => {
    const { usernames } = ctx.request.body as { usernames?: Array<string> };

    if (!usernames || !Array.isArray(usernames)) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'usernames array is required' };
        return;
    }

    if (usernames.length === 0) {
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

        ctx.body = {
            success: true,
            users: users.map((user) => ({
                id: user._id.toString(),
                username: user.username,
            })),
        };
    } catch (error) {
        const logger = dependencyContainer.resolve(DependencyToken.Logger);
        logger.error('Error fetching users', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
