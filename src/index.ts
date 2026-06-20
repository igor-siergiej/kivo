import { errorHandler, requestLogger } from '@imapps/api-utils/hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { dependencyContainer, registerDepdendencies } from './dependencies.js';
import { initializeDatabase } from './lib/database/init.js';
import { DependencyToken } from './lib/dependencyContainer/types.js';
import {
    httpRequestDurationSeconds,
    httpRequestsTotal,
    metricsRegister,
    normalizePath,
    rateLimitHitsTotal,
    startDefaultMetrics,
} from './lib/metrics.js';
import { processCloudflareHeaders } from './middleware/cloudflare.js';
import { checkGlobalRateLimit } from './middleware/rateLimit.js';
import { applySecurityHeaders } from './middleware/security.js';
import { login } from './routes/login/index.js';
import { logout } from './routes/logout/index.js';
import { refresh } from './routes/refresh/index.js';
import { register } from './routes/register/index.js';
import { search } from './routes/search/index.js';
import { getUsersByUsernames } from './routes/users/index.js';
import { verify } from './routes/verify/index.js';

export const onStartup = async () => {
    try {
        startDefaultMetrics();
        registerDepdendencies();

        const database = dependencyContainer.resolve(DependencyToken.Database);
        const config = dependencyContainer.resolve(DependencyToken.Config);
        const logger = dependencyContainer.resolve(DependencyToken.Logger);

        if (!database || !config) {
            throw new Error('Could not resolve database or config dependencies');
        }

        logger.info('Starting Kivo authentication service - connecting to database');
        await database.connect({
            // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
            connectionUri: config.get('connectionUri') as any,
            // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
            databaseName: config.get('databaseName') as any,
        });
        logger.info('Connected to database');

        await initializeDatabase();

        logger.info('Creating database indexes');
        const sessions = database.getCollection('sessions');
        await sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }).catch((error) => {
            logger.error('Error creating session index', error);
        });
        logger.info('Database indexes created');

        // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
        const corsOriginsList = (config.get('corsAllowedOrigins') as any).split(',').map((o: string) => o.trim());

        const app = new Hono();

        // CORS
        app.use(
            '*',
            cors({
                allowHeaders: ['Content-Type', 'Authorization', 'Origin'],
                credentials: true,
                allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
                origin: (origin) => (corsOriginsList.includes(origin) ? origin : null),
            })
        );

        // Request logger
        app.use('*', requestLogger(logger));

        // Cloudflare header processing
        app.use('*', processCloudflareHeaders);

        // Security headers
        app.use('*', applySecurityHeaders);

        // Per-request timing for Prometheus histogram
        const requestStartTimes = new WeakMap<Request, number>();

        app.use('*', async (c, next) => {
            requestStartTimes.set(c.req.raw, performance.now());
            await next();

            const url = c.req.path;
            const path = normalizePath(url);
            const status = String(c.res.status || 200);
            const labels = { method: c.req.method, path, status };

            httpRequestsTotal.inc(labels);
            const start = requestStartTimes.get(c.req.raw);
            requestStartTimes.delete(c.req.raw);
            if (start !== undefined) {
                httpRequestDurationSeconds.observe(labels, (performance.now() - start) / 1000);
            }
        });

        // Global rate limit (skip for metrics and health)
        app.use('*', async (c, next) => {
            const url = c.req.path;
            if (url === '/metrics' || url === '/health') {
                return next();
            }

            const rateLimitResult = checkGlobalRateLimit(c.req.raw);
            if (!rateLimitResult.allowed) {
                rateLimitHitsTotal.inc();
                return c.json(
                    {
                        success: false,
                        message: 'Too many requests, please slow down.',
                        retryAfter: rateLimitResult.retryAfter,
                    },
                    429
                );
            }
            return next();
        });

        // Error handler
        app.onError(errorHandler);

        // Health check
        app.get('/health', (c) =>
            c.json({
                status: 'healthy',
                service: 'kivo',
                timestamp: new Date().toISOString(),
            })
        );

        // Prometheus metrics
        app.get('/metrics', async (c) => {
            c.header('Content-Type', metricsRegister.contentType);
            return c.body(await metricsRegister.metrics());
        });

        // Auth routes
        app.post('/login', login);
        app.post('/register', register);
        app.post('/refresh', refresh);
        app.get('/verify', verify);
        app.post('/logout', logout);

        // Search
        app.get('/search', search);

        // User management
        app.post('/users', getUsersByUsernames);

        // 404 handler
        app.all('*', (c) => c.json({ error: 'Not Found' }, 404));

        // biome-ignore lint/suspicious/noExplicitAny: ConfigService get() returns unknown
        const port = config.get('port') as any;
        Bun.serve({
            port,
            fetch: app.fetch,
        });

        logger.info(`Kivo authentication service running on port ${port}`);
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
