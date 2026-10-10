import type { Context } from 'hono';
import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { checkSearchRateLimit } from './middleware.js';

// Candidates fetched before ranking; well above the 20 max page size
const SEARCH_CANDIDATE_LIMIT = 100;

export const search = async (c: Context) => {
    const rateLimitResult = checkSearchRateLimit(c.req.raw);

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
        const escapedQuery = sanitizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // One scan over a small collection: substring matches, with prefix matches ranked first
        const matches = await usersCollection
            .find(
                { username: new RegExp(escapedQuery, 'i') },
                { projection: { username: 1, _id: 0 }, limit: SEARCH_CANDIDATE_LIMIT, sort: { username: 1 } }
            )
            .toArray();

        const isPrefix = (username: string) => username.toLowerCase().startsWith(sanitizedQuery);
        const results = [
            ...matches.filter((user) => isPrefix(user.username)),
            ...matches.filter((user) => !isPrefix(user.username)),
        ].slice(0, parsedLimit);

        const usernames = results.map((user) => user.username);

        logger.info('User search completed', {
            query: sanitizedQuery,
            resultsCount: usernames.length,
            limit: parsedLimit,
        });

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
