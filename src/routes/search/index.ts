import { dependencyContainer } from '../../dependencies.js';
import { DependencyToken } from '../../lib/dependencyContainer/types.js';
import { checkSearchRateLimit } from './middleware.js';

interface SearchRequest {
    query?: Record<string, string | string[]>;
    request: any;
    set: any;
}

export const search = async ({ query, request, set }: SearchRequest) => {
    // Check search rate limit
    const rateLimitResult = checkSearchRateLimit(request);

    // Apply security headers
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['X-XSS-Protection'] = '1; mode=block';
    set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
    set.headers.Pragma = 'no-cache';
    set.headers.Expires = '0';

    if (!rateLimitResult.allowed) {
        set.status = 429;
        return {
            success: false,
            message: 'Search rate limit exceeded. Please try again later.',
            retryAfter: rateLimitResult.retryAfter,
        };
    }
    const { q: rawQuery, limit = '10' } = query as {
        q?: string;
        limit?: string;
    };
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    // Input validation and sanitization
    if (!rawQuery || typeof rawQuery !== 'string') {
        logger.warn('User search with missing or invalid query parameter');
        set.status = 400;
        return {
            success: false,
            message: 'Query parameter "q" is required and must be a string',
        };
    }

    // Sanitize and validate query length
    const sanitizedQuery = rawQuery.trim().toLowerCase();
    if (sanitizedQuery.length < 2) {
        logger.warn('User search with query too short', {
            queryLength: sanitizedQuery.length,
        });
        set.status = 400;
        return { success: false, message: 'Query must be at least 2 characters long' };
    }

    if (sanitizedQuery.length > 50) {
        logger.warn('User search with query too long', {
            queryLength: sanitizedQuery.length,
        });
        set.status = 400;
        return {
            success: false,
            message: 'Query too long (max 50 characters)',
        };
    }

    // Validate and parse limit
    const parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        logger.warn('User search with invalid limit', { limit });
        set.status = 400;
        return { success: false, message: 'Limit must be between 1 and 20' };
    }

    try {
        const database = dependencyContainer.resolve(DependencyToken.Database);
        if (!database) {
            logger.error('Database service not available');
            set.status = 503;
            return { success: false, message: 'Service unavailable' };
        }

        const usersCollection = database.getCollection('users');
        let results: Array<{ username: string; score?: number }> = [];

        try {
            // Try text search first
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
            // Text search might fail if index doesn't exist, fall back to regex
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

        set.headers['Cache-Control'] = 'public, max-age=30';
        set.headers['X-Query-Time'] = Date.now().toString();

        return {
            success: true,
            usernames,
            count: usernames.length,
            query: sanitizedQuery,
        };
    } catch (error) {
        logger.error('User search error', error);
        set.status = 500;
        return { success: false, message: 'Internal server error' };
    }
};
