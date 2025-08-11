import 'dotenv/config';

import { IConfig } from './types';

export class ConfigError extends Error {
    constructor(variable: string) {
        super(`Environment variable '${variable}' is missing`);
        this.name = 'ConfigError';
    }
}

export class ConfigService implements IConfig {
    readonly port: number;
    readonly connectionUri: string;
    readonly databaseName: string;
    readonly jwtSecret: string;
    readonly accessTokenExpiry: string;
    readonly refreshTokenExpiry: string;
    readonly secure: boolean;
    readonly sameSite: 'strict' | 'lax' | 'none';

    constructor() {
        this.port = Number(this.getEnv('PORT'));
        this.connectionUri = this.getEnv('CONNECTION_URI');
        this.databaseName = this.getEnv('DATABASE_NAME');
        this.jwtSecret = this.getEnv('JWT_SECRET');
        this.accessTokenExpiry = this.getEnv('ACCESS_TOKEN_EXPIRY');
        this.refreshTokenExpiry = this.getEnv('REFRESH_TOKEN_EXPIRY');
        this.secure = this.getEnv('SECURE') === 'true';
        const ss = (this.getEnv('SAME_SITE') || 'strict').toLowerCase();

        const allowed = ['strict', 'lax', 'none'];
        this.sameSite = allowed.includes(ss) ? (ss as 'strict' | 'lax' | 'none') : 'strict';
    }

    getEnv(key: string): string {
        const value = process.env[key];
        if (!value) {
            throw new ConfigError(key);
        }
        return value as string;
    }
}
