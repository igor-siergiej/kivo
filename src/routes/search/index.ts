import type { Context } from 'koa';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../lib/dependencyContainer/types';

export const search = async (ctx: Context) => {
    const { q: query, limit = '10' } = ctx.query as { q?: string; limit?: string };
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    // Input validation and sanitization
    if (!query || typeof query !== 'string') {
        logger.warn('User search with missing or invalid query parameter');
        ctx.status = 400;
        ctx.body = { success: false, message: 'Query parameter "q" is required and must be a string' };
        return;
    }

    // Sanitize and validate query length
    const sanitizedQuery = query.trim().toLowerCase();
    if (sanitizedQuery.length < 2) {
        logger.warn('User search with query too short', { queryLength: sanitizedQuery.length });
        ctx.status = 400;
        ctx.body = { success: false, message: 'Query must be at least 2 characters long' };
        return;
    }

    if (sanitizedQuery.length > 50) {
        logger.warn('User search with query too long', { queryLength: sanitizedQuery.length });
        ctx.status = 400;
        ctx.body = { success: false, message: 'Query too long (max 50 characters)' };
        return;
    }

    // Validate and parse limit
    const parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        logger.warn('User search with invalid limit', { limit });
        ctx.status = 400;
        ctx.body = { success: false, message: 'Limit must be between 1 and 20' };
        return;
    }

    // Client IP detection (already handled by rate limiting middleware)
    // No additional IP check needed here as middleware handles rate limiting

    try {
        const database = dependencyContainer.resolve(DependencyToken.Database);
        if (!database) {
            logger.error('Database service not available');
            ctx.status = 503;
            ctx.body = { success: false, message: 'Service unavailable' };
            return;
        }

        const usersCollection = database.getCollection('users');
        let results = [];

        try {
            // Try text search first
            results = await usersCollection
                .find(
                    { $text: { $search: sanitizedQuery } },
                    {
                        projection: { username: 1, _id: 0, score: { $meta: 'textScore' } },
                        limit: parsedLimit,
                        sort: { score: { $meta: 'textScore' }, username: 1 },
                    }
                )
                .toArray();
        } catch (textSearchError) {
            // Text search might fail if index doesn't exist, fall back to regex
            logger.warn('Text search failed, falling back to regex', { error: textSearchError });
        }

        if (results.length === 0) {
            const escapedQuery = sanitizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(escapedQuery, 'i');

            const fallbackResults = await usersCollection
                .find(
                    { username: searchRegex },
                    {
                        projection: { username: 1, _id: 0 },
                        limit: parsedLimit,
                        sort: { username: 1 },
                    }
                )
                .toArray();

            results.push(...fallbackResults);
        }

        const usernames = results.map((user) => user.username);

        logger.info('User search completed', {
            query: sanitizedQuery,
            resultsCount: usernames.length,
            limit: parsedLimit,
        });

        ctx.set('Cache-Control', 'public, max-age=30');
        ctx.set('X-Query-Time', Date.now().toString());

        ctx.body = {
            success: true,
            usernames,
            count: usernames.length,
            query: sanitizedQuery,
        };
    } catch (error) {
        logger.error('User search error', error);
        ctx.status = 500;
        ctx.body = { success: false, message: 'Internal server error' };
    }
};
