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
} as const;

export const config = new BaseConfigService(schema);
export const ConfigService = BaseConfigService;
