import { ConfigService as BaseConfigService, parsers } from '@igor-siergiej/api-utils';

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
    corsAllowNoOrigin: {
        parser: parsers.boolean,
        from: 'CORS_ALLOW_NO_ORIGIN',
        defaultValue: true,
    },
} as const;

export const config = new BaseConfigService(schema);
export const ConfigService = BaseConfigService;
