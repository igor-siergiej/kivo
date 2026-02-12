import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import Elysia from 'elysia';
import { dependencyContainer, registerDepdendencies } from './dependencies.js';
import { initializeDatabase } from './lib/database/init.js';
import { DependencyToken } from './lib/dependencyContainer/types.js';
import { checkGlobalRateLimit } from './middleware/rateLimit.js';
import { login } from './routes/login/index.js';
import { logout } from './routes/logout/index.js';
import { refresh } from './routes/refresh/index.js';
import { register } from './routes/register/index.js';
import { search } from './routes/search/index.js';
import { getUsersByUsernames } from './routes/users/index.js';
import { verify } from './routes/verify/index.js';

export const onStartup = async () => {
    try {
        registerDepdendencies();

        const database = dependencyContainer.resolve(DependencyToken.Database);
        const config = dependencyContainer.resolve(DependencyToken.Config);
        const logger = dependencyContainer.resolve(DependencyToken.Logger);

        if (!database || !config) {
            throw new Error('Could not resolve database or config dependencies');
        }

        logger.info('Starting Kivo authentication service - connecting to database');
        await database.connect({
            connectionUri: config.get('connectionUri'),
            databaseName: config.get('databaseName'),
        });
        logger.info('Connected to database');

        await initializeDatabase();

        logger.info('Creating database indexes');
        const sessions = database.getCollection('sessions');
        await sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }).catch((error) => {
            logger.error('Error creating session index', error);
        });
        logger.info('Database indexes created');

        // Setup CORS configuration from environment
        const corsOriginsList = config
            .get('corsAllowedOrigins')
            .split(',')
            .map((o: string) => o.trim());
        const _corsAllowNoOrigin = config.get('corsAllowNoOrigin');

        const jwtSecret = config.get('jwtSecret');
        const secure = config.get('secure');
        const sameSite = config.get('sameSite');

        const app = new Elysia()
            // Register cookie plugin first (needed for refresh, login, logout)
            .use(
                cookie({
                    secure,
                    httpOnly: true,
                    sameSite,
                })
            )
            // Register CORS plugin
            .use(
                cors({
                    allowedHeaders: ['Content-Type', 'Authorization', 'Origin'],
                    credentials: true,
                    methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
                    origin: corsOriginsList,
                })
            )
            // Register JWT plugin
            .use(
                jwt({
                    name: 'jwt',
                    secret: jwtSecret,
                })
            );

        // Global request hooks
        app.onBeforeHandle(({ request, set }) => {
            // Check rate limit
            const rateLimitResult = checkGlobalRateLimit(request);
            if (!rateLimitResult.allowed) {
                set.status = 429;
                return {
                    success: false,
                    message: 'Too many requests, please slow down.',
                    retryAfter: rateLimitResult.retryAfter,
                };
            }
        });

        // Cloudflare header processing
        app.onRequest(async ({ request }) => {
            const cfVisitor = request.headers.get('cf-visitor');
            if (cfVisitor) {
                try {
                    const parsed = JSON.parse(cfVisitor);
                    if (parsed.scheme === 'https') {
                        request.headers.set('x-forwarded-proto', 'https');
                        request.headers.set('x-forwarded-scheme', 'https');
                    }
                } catch {
                    // Ignore parsing errors
                }
            }
        });

        // Request logging hook
        app.onRequest(async ({ request }) => {
            const url = new URL(request.url);
            logger.info(`${request.method} ${url.pathname}`, {
                method: request.method,
                path: url.pathname,
            });
        });

        // Response logging hook (onAfterResponse)
        app.onAfterResponse(async ({ request, response, set }) => {
            const url = new URL(request.url);
            const status = set.status || 200;
            logger.info(`${request.method} ${url.pathname}`, {
                method: request.method,
                path: url.pathname,
                status: status,
            });
        });

        // Error handler
        app.onError(({ error, request, set }) => {
            const url = new URL(request.url);
            const status = 500;
            let message = 'Internal Server Error';

            if (error instanceof Error) {
                message = error.message;
                logger.error('Unhandled error', {
                    error: error.message,
                    stack: error.stack,
                    path: url.pathname,
                    method: request.method,
                });
            }

            set.status = status;
            return {
                success: false,
                message,
            };
        });

        // Health check endpoint
        app.get('/health', () => ({
            status: 'healthy',
            service: 'kivo',
            timestamp: new Date().toISOString(),
        }));

        // Auth routes
        app.post('/login', login);
        app.post('/register', register);
        app.post('/refresh', refresh);
        app.get('/verify', verify);
        app.post('/logout', logout);

        // Search endpoint (rate limiting handled inside handler)
        app.get('/search', search);

        // User management
        app.post('/users', getUsersByUsernames);

        // 404 handler
        app.all('*', ({ set }) => {
            set.status = 404;
            return { error: 'Not Found' };
        });

        const port = config.get('port');
        app.listen(port, () => {
            logger.info(`Kivo authentication service running on port ${port}`);
        });
    } catch (error: unknown) {
        const logger = dependencyContainer.resolve(DependencyToken.Logger);

        if (error instanceof Error) {
            if (logger) {
                logger.error('Encountered an error on start up', {
                    error: error.message,
                });
            }
        } else {
            if (logger) {
                logger.error('Encountered unexpected error on start up', {
                    error,
                });
            }
        }

        process.exit(1);
    }
};

onStartup();
