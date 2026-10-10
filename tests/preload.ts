// Config is built at import time and reads these; CI has no .env.
const defaults: Record<string, string> = {
    PORT: '3008',
    CONNECTION_URI: 'mongodb://localhost:27017',
    DATABASE_NAME: 'kivo_test',
    JWT_SECRET: 'test-secret-test-secret',
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    SECURE: 'false',
    SAME_SITE: 'Lax',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    CORS_ALLOW_NO_ORIGIN: 'true',
};

for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
}
