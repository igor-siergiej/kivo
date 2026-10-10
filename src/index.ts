import { requestLogger } from '@imapps/api-utils/hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { dependencyContainer, registerDepdendencies } from './dependencies.js';
import { getSigningKeys } from './lib/auth/keys.js';
import { initializeDatabase } from './lib/database/init.js';
import { DependencyToken } from './lib/dependencyContainer/types.js';
import { createErrorHandler } from './lib/errors/handler.js';
import {
    httpRequestDurationSeconds,
    httpRequestsTotal,
    metricsRegister,
    normalizePath,
    rateLimitHitsTotal,
    startDefaultMetrics,
} from './lib/metrics.js';
import { internalOnly } from './middleware/internalOnly.js';
import { requireLookupAuth } from './middleware/lookupAuth.js';
import { checkGlobalRateLimit, getVerifiedUserId } from './middleware/rateLimit.js';
import { applySecurityHeaders } from './middleware/security.js';
import { login } from './routes/login/index.js';
import { logout, logoutAll } from './routes/logout/index.js';
import { refresh } from './routes/refresh/index.js';
import { register } from './routes/register/index.js';
import { search } from './routes/search/index.js';
import { getUsersByUsernames } from './routes/users/index.js';
import { verify } from './routes/verify/index.js';
import { NOT_FOUND_BODY } from './types/index.js';

const MAX_BODY_BYTES = 16 * 1024;
const SHUTDOWN_TIMEOUT_MS = 10_000;

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
            connectionUri: config.get('connectionUri'),
            databaseName: config.get('databaseName'),
        });
        logger.info('Connected to database');

        getSigningKeys(); // fail fast on a malformed JWT_PRIVATE_KEY

        await initializeDatabase();

        const corsOriginsList = config
            .get('corsAllowedOrigins')
            .split(',')
            .map((o: string) => o.trim());

        const jwtSecret = config.get('jwtSecret');
        if (typeof jwtSecret !== 'string') {
            throw new Error('jwtSecret is not configured');
        }

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

        // Auth payloads are tiny; reject anything larger before parsing
        app.use(
            '*',
            bodyLimit({
                maxSize: MAX_BODY_BYTES,
                onError: (c) => c.json({ success: false, message: 'Request body too large' }, 413),
            })
        );

        // Request logger
        app.use('*', requestLogger(logger));

        // Security headers
        app.use('*', applySecurityHeaders);

        // Per-request timing for Prometheus histogram
        app.use('*', async (c, next) => {
            const start = performance.now();
            await next();

            const labels = {
                method: c.req.method,
                path: normalizePath(c.req.path),
                status: String(c.res.status || 200),
            };

            httpRequestsTotal.inc(labels);
            httpRequestDurationSeconds.observe(labels, (performance.now() - start) / 1000);
        });

        // Global rate limit (skip for metrics and health)
        app.use('*', async (c, next) => {
            const url = c.req.path;
            if (url === '/metrics' || url === '/health' || url === '/ready') {
                return next();
            }

            const userId = getVerifiedUserId(c.req.raw, jwtSecret);
            const rateLimitResult = checkGlobalRateLimit(c.req.raw, userId);
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
        app.onError(createErrorHandler(logger));

        // Health check
        app.get('/health', (c) =>
            c.json({
                status: 'healthy',
                service: 'kivo',
                timestamp: new Date().toISOString(),
            })
        );

        // Readiness: only healthy while MongoDB answers, so orchestrators stop routing during DB outages
        app.get('/ready', async (c) => {
            const databaseUp = await database.ping().catch(() => false);
            return c.json({ status: databaseUp ? 'ready' : 'unavailable', service: 'kivo' }, databaseUp ? 200 : 503);
        });

        // Public signing key (empty while tokens are still HS256 only)
        app.get('/.well-known/jwks.json', (c) => {
            c.header('Cache-Control', 'public, max-age=300');
            return c.json({ keys: getSigningKeys() ? [getSigningKeys()?.jwk] : [] });
        });

        // Prometheus metrics
        app.get('/metrics', internalOnly, async (c) => {
            c.header('Content-Type', metricsRegister.contentType);
            return c.body(await metricsRegister.metrics());
        });

        // Auth routes
        app.post('/login', login);
        app.post('/register', register);
        app.post('/refresh', refresh);
        app.get('/verify', verify);
        app.post('/logout', logout);
        app.post('/logout-all', logoutAll);

        // Search
        app.get('/search', requireLookupAuth({ allowServiceToken: false }), search);

        // User management
        app.post('/users', requireLookupAuth({ allowServiceToken: true }), getUsersByUsernames);

        // 404 handler
        app.all('*', (c) => c.json(NOT_FOUND_BODY, 404));

        const port = config.get('port');
        const server = Bun.serve({
            port,
            fetch: app.fetch,
        });

        // Let in-flight requests finish on deploy/restart, but never hang the container's stop
        let shuttingDown = false;
        const shutdown = async (signal: string) => {
            if (shuttingDown) return;
            shuttingDown = true;
            logger.info(`Received ${signal}, shutting down`);
            setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
            await server.stop();
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

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
