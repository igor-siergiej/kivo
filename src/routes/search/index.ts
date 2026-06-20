import type { Context } from 'hono';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { checkSearchRateLimit } from './middleware.js';

export const search = async (c: Context) => {
    const rateLimitResult = checkSearchRateLimit(c.req.raw);

    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    if (!rateLimitResult.allowed) {
        return c.json(
            {
                success: false,
                message: 'Search rate limit exceeded. Please try again later.',
                retryAfter: rateLimitResult.retryAfter,
            },
            429
        );
    }

    const rawQuery = c.req.query('q');
    const limit = c.req.query('limit') ?? '10';
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    if (!rawQuery || typeof rawQuery !== 'string') {
        logger.warn('User search with missing or invalid query parameter');
        return c.json(
            {
                success: false,
                message: 'Query parameter "q" is required and must be a string',
            },
            400
        );
    }

    const sanitizedQuery = rawQuery.trim().toLowerCase();
    if (sanitizedQuery.length < 2) {
        logger.warn('User search with query too short', {
            queryLength: sanitizedQuery.length,
        });
        return c.json({ success: false, message: 'Query must be at least 2 characters long' }, 400);
    }

    if (sanitizedQuery.length > 50) {
        logger.warn('User search with query too long', {
            queryLength: sanitizedQuery.length,
        });
        return c.json({ success: false, message: 'Query too long (max 50 characters)' }, 400);
    }

    const parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        logger.warn('User search with invalid limit', { limit });
        return c.json({ success: false, message: 'Limit must be between 1 and 20' }, 400);
    }

    try {
        const database = dependencyContainer.resolve(DependencyToken.Database);
        if (!database) {
            logger.error('Database service not available');
            return c.json({ success: false, message: 'Service unavailable' }, 503);
        }

        const usersCollection = database.getCollection('users');
        let results: Array<{ username: string; score?: number }> = [];

        try {
            results = await usersCollection
                .find(
                    { $text: { $search: sanitizedQuery } },
                    {
                        projection: {
                            username: 1,
                            _id: 0,
                            score: { $meta: 'textScore' },
                        },
                        limit: parsedLimit,
                        sort: {
                            score: { $meta: 'textScore' },
                            username: 1,
                        },
                    }
                )
                .toArray();
        } catch (textSearchError) {
            logger.warn('Text search failed, falling back to regex', {
                error: textSearchError,
            });
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

        c.header('Cache-Control', 'public, max-age=30');
        c.header('X-Query-Time', Date.now().toString());

        return c.json({
            success: true,
            usernames,
            count: usernames.length,
            query: sanitizedQuery,
        });
    } catch (error) {
        logger.error('User search error', error);
        return c.json({ success: false, message: 'Internal server error' }, 500);
    }
};
