import { ConfigService as BaseConfigService, parsers } from '@imapps/api-utils';
import type { SignOptions } from 'jsonwebtoken';

const duration = (value: string) => value as SignOptions['expiresIn'];

const sameSite = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized === 'strict') return 'Strict' as const;
    if (normalized === 'lax') return 'Lax' as const;
    if (normalized === 'none') return 'None' as const;
    throw new Error(`SAME_SITE must be Strict, Lax or None, got '${value}'`);
};

const schema = {
    port: { parser: parsers.number, from: 'PORT' },
    connectionUri: { parser: parsers.string, from: 'CONNECTION_URI' },
    databaseName: { parser: parsers.string, from: 'DATABASE_NAME' },
    jwtSecret: { parser: parsers.string, from: 'JWT_SECRET' },
    accessTokenExpiry: { parser: duration, from: 'ACCESS_TOKEN_EXPIRY' },
    refreshTokenExpiry: { parser: duration, from: 'REFRESH_TOKEN_EXPIRY' },
    secure: { parser: parsers.boolean, from: 'SECURE' },
    sameSite: { parser: sameSite, from: 'SAME_SITE' },
    corsAllowedOrigins: {
        parser: parsers.string,
        from: 'CORS_ALLOWED_ORIGINS',
        default: 'http://localhost:3000,http://localhost:4000',
    },
} as const;

export type AppConfig = BaseConfigService<typeof schema>;
export const config: AppConfig = new BaseConfigService(schema);
export const ConfigService = BaseConfigService;
