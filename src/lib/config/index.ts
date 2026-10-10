import { ConfigService as BaseConfigService, parsers } from '@imapps/api-utils';

const schema = {
    port: { parser: parsers.number, from: 'PORT' },
    connectionUri: { parser: parsers.string, from: 'CONNECTION_URI' },
    databaseName: { parser: parsers.string, from: 'DATABASE_NAME' },
    jwtSecret: { parser: parsers.string, from: 'JWT_SECRET' },
    accessTokenExpiry: { parser: parsers.string, from: 'ACCESS_TOKEN_EXPIRY' },
    refreshTokenExpiry: { parser: parsers.string, from: 'REFRESH_TOKEN_EXPIRY' },
    secure: { parser: parsers.boolean, from: 'SECURE' },
    sameSite: { parser: parsers.string, from: 'SAME_SITE' },
    corsAllowedOrigins: {
        parser: parsers.string,
        from: 'CORS_ALLOWED_ORIGINS',
        defaultValue: 'http://localhost:3000,http://localhost:4000',
    },
} as const;

export const config = new BaseConfigService(schema);
export const ConfigService = BaseConfigService;
