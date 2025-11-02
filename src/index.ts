import Koa, { type Context, type Request } from 'koa';
import { koaBody } from 'koa-body';
import koaCors, { type Options } from 'koa-cors';
import helmet from 'koa-helmet';
import KoaLogger from 'koa-logger';
import ratelimit from 'koa-ratelimit';

import { dependencyContainer, registerDepdendencies } from './dependencies';
import { initializeDatabase } from './lib/database/init';
import { DependencyToken } from './lib/dependencyContainer/types';
import routes from './routes';
import { HttpErrorCode } from './types';

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://shoppingo.imapps.staging',
    'http://jewellerycatalogue.imapps.staging',
    'https://jewellerycatalogue.imapps.co.uk',
    'https://shoppingo.imapps.co.uk',
];

const koaLogger = KoaLogger();

const corsOptions: Options = {
    origin: (request: Request) => {
        const originHeader = request.headers.origin || '';
        return allowedOrigins.includes(originHeader) ? originHeader : '*';
    },
    methods: ['POST'],
    credentials: true,
    headers: ['Content-Type'],
};

const bodyOptions = {
    formidable: {
        keepExtensions: true,
    },
};

export const onStartup = async () => {
    try {
        registerDepdendencies();

        const app = new Koa();
        app.proxy = true;

        app.use(async (ctx, next) => {
            const cfVisitor = ctx.headers['cf-visitor'];
            if (cfVisitor) {
                try {
                    const parsed = JSON.parse(cfVisitor as string);
                    if (parsed.scheme === 'https') {
                        ctx.headers['x-forwarded-proto'] = 'https';
                        ctx.headers['x-forwarded-scheme'] = 'https';
                    }
                } catch (error) {
                    console.error('Error parsing cf-visitor header:', error);
                }
            }
            await next();
        });

        app.use(helmet());
        app.use(
            ratelimit({
                driver: 'memory',
                db: new Map(),
                duration: 60 * 1000,
                errorMessage: 'Too many requests, please slow down.',
                id: (ctx: Context) => ctx.ip,
                max: 50,
            })
        );
        app.use(koaCors(corsOptions));
        app.use(koaLogger);
        app.use(koaBody(bodyOptions));
        app.use(async (ctx, next) => {
            try {
                await next();
            } catch (err) {
                ctx.status = err.status || HttpErrorCode.InternalServerError;
                ctx.body = {
                    success: false,
                    message: err.message || 'Internal Server Error',
                };
                ctx.app.emit('error', err, ctx);
            }
        });

        app.on('error', (err, ctx) => {
            const logger = dependencyContainer.resolve(DependencyToken.Logger);

            if (logger) {
                logger.error('Server Error', {
                    message: err.message,
                    stack: err.stack,
                    path: ctx.request.path,
                    method: ctx.request.method,
                });
            }
        });

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

        app.use(routes.routes());

        app.listen(config.get('port'), () => {
            logger.info(`Kivo authentication service running on port ${config.get('port')}`);
        });
    } catch (error: unknown) {
        const logger = dependencyContainer.resolve(DependencyToken.Logger);

        if (error instanceof Error) {
            if (logger) {
                logger.error('Encountered an error on start up', { error: error.message });
            }
        } else {
            if (logger) {
                logger.error('Encountered unexpected error on start up', { error });
            }
        }

        process.exit(1);
    }
};

onStartup();
