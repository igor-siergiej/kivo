import 'dotenv/config';

import Koa, { Context, Request } from 'koa';
import koaBody from 'koa-body';
import koaCors, { Options } from 'koa-cors';
import helmet from 'koa-helmet';
import KoaLogger from 'koa-logger';
import ratelimit from 'koa-ratelimit';

import { registerDepdendencies } from './dependencies';
import { CollectionName, Session } from './lib/database/types';
import { DependencyContainer } from './lib/dependencyContainer';
import { DependencyToken } from './lib/dependencyContainer/types';
import { initializeDatabase } from './lib/database/init';
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

const logger = KoaLogger();

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
    }
};

export const onStartup = async () => {
    try {
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
        app.use(ratelimit({
            driver: 'memory',
            db: new Map(),
            duration: 60 * 1000,
            errorMessage: 'Too many requests, please slow down.',
            id: (ctx: Context) => ctx.ip,
            max: 50
        }));
        app.use(koaCors(corsOptions));
        app.use(logger);
        app.use(koaBody(bodyOptions));
        app.use(async (ctx, next) => {
            try {
                await next();
            } catch (err) {
                ctx.status = err.status || HttpErrorCode.InternalServerError;
                ctx.body = {
                    success: false,
                    message: err.message || 'Internal Server Error'
                };
                ctx.app.emit('error', err, ctx);
            }
        });

        app.on('error', (err, ctx) => {
            console.error('Server Error:', {
                message: err.message,
                stack: err.stack,
                path: ctx.request.path,
                method: ctx.request.method
            });
        });

        registerDepdendencies();

        const database = DependencyContainer.getInstance().resolve(DependencyToken.Database);
        const config = DependencyContainer.getInstance().resolve(DependencyToken.Config);

        if (!database || !config) {
            throw new Error('Could not connect to DB or config');
        }

        await database.connect();

        await initializeDatabase();

        const sessions = database.getCollection<Session>(CollectionName.Sessions);
        sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }).catch((error) => {
            console.error('Error creating session index', error);
        });

        app.use(routes.routes());

        app.listen(config.port, () => {
            console.log(`kivo running on port ${config.port}.`);
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Encountered an error on start up', error.message);
        } else {
            console.error('Encountered unexpected error on start up', error);
        }
        process.exit(1);
    }
};

onStartup();
