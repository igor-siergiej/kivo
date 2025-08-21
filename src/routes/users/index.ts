import { Context } from 'koa';
import { CollectionName, User } from '../../lib/database/types';
import { DependencyContainer } from '../../lib/dependencyContainer';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const getUsersByUsernames = async (ctx: Context) => {
    const { usernames } = ctx.request.body as { usernames?: string[] };

    if (!usernames || !Array.isArray(usernames)) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'usernames array is required' };
        return;
    }

    if (usernames.length === 0) {
        ctx.body = { success: true, users: [] };
        return;
    }

    const container = DependencyContainer.getInstance();
    const database = container.resolve(DependencyToken.Database)!;

    const usersCollection = database.getCollection<User>(CollectionName.Users);

    try {
        const users = await usersCollection
            .find({ username: { $in: usernames } })
            .project({ username: 1, _id: 1 })
            .toArray();

        ctx.body = {
            success: true,
            users: users.map(user => ({
                id: user._id.toString(),
                username: user.username
            }))
        };
    } catch (error) {
        console.error('Error fetching users:', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
