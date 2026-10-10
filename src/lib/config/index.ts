import { ConfigService as BaseConfigService, parsers } from '@imapps/api-utils';
import type { SignOptions } from 'jsonwebtoken';
import { durationToSeconds } from '../utils/duration';

const duration = (value: string) => {
    durationToSeconds(value);
    return value as SignOptions['expiresIn'];
};

const jwtSecret = (value: string) => {
    if (value.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
    return value;
};

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
    jwtSecret: { parser: jwtSecret, from: 'JWT_SECRET' },
    accessTokenExpiry: { parser: duration, from: 'ACCESS_TOKEN_EXPIRY' },
    refreshTokenExpiry: { parser: duration, from: 'REFRESH_TOKEN_EXPIRY' },
    secure: { parser: parsers.boolean, from: 'SECURE' },
    sameSite: { parser: sameSite, from: 'SAME_SITE' },
    // When true, /users and /search require a bearer access token (or X-Service-Token for /users)
    lookupAuthEnabled: { parser: parsers.boolean, from: 'LOOKUP_AUTH_ENABLED', default: false },
    serviceToken: { parser: parsers.string, from: 'SERVICE_TOKEN', optional: true },
    corsAllowedOrigins: {
        parser: parsers.string,
        from: 'CORS_ALLOWED_ORIGINS',
        default: 'http://localhost:3000,http://localhost:4000',
    },
} as const;

export type AppConfig = BaseConfigService<typeof schema>;
export const config: AppConfig = new BaseConfigService(schema);
export const ConfigService = BaseConfigService;
