import { Context } from 'koa';

import { CollectionName, User } from '../../lib/database/types';
import { DependencyContainer } from '../../lib/dependencyContainer';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const search = async (ctx: Context) => {
    const { q: query, limit = '10' } = ctx.query as { q?: string; limit?: string };

    // Input validation and sanitization
    if (!query || typeof query !== 'string') {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Query parameter "q" is required and must be a string' };
        return;
    }

    // Sanitize and validate query length
    const sanitizedQuery = query.trim().toLowerCase();
    if (sanitizedQuery.length < 2) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Query must be at least 2 characters long' };
        return;
    }

    if (sanitizedQuery.length > 50) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Query too long (max 50 characters)' };
        return;
    }

    // Validate and parse limit
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Limit must be between 1 and 20' };
        return;
    }

    // Rate limiting check (you can enhance this with your existing rate limiting middleware)
    const clientIP = ctx.ip || ctx.request.ip;
    if (!clientIP) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Too many requests' };
        return;
    }

    try {
        const container = DependencyContainer.getInstance();
        const database = container.resolve(DependencyToken.Database)!;
        const usersCollection = database.getCollection<User>(CollectionName.Users);

        const results = await usersCollection
            .find(
                { $text: { $search: sanitizedQuery } },
                {
                    projection: { username: 1, _id: 0, score: { $meta: 'textScore' } },
                    limit: parsedLimit,
                    sort: { score: { $meta: 'textScore' }, username: 1 }
                }
            )
            .toArray();

        if (results.length === 0) {
            const escapedQuery = sanitizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(escapedQuery, 'i');

            const fallbackResults = await usersCollection
                .find(
                    { username: searchRegex },
                    {
                        projection: { username: 1, _id: 0 },
                        limit: parsedLimit,
                        sort: { username: 1 }
                    }
                )
                .toArray();

            results.push(...fallbackResults);
        }

        const usernames = results.map(user => user.username);

        ctx.set('Cache-Control', 'public, max-age=30');
        ctx.set('X-Query-Time', Date.now().toString());

        ctx.body = {
            success: true,
            usernames,
            count: usernames.length,
            query: sanitizedQuery
        };
    } catch (error) {
        console.error('Search error:', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
