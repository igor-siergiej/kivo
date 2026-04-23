import { Counter, collectDefaultMetrics, Histogram, register } from 'prom-client';

let defaultsStarted = false;

export const startDefaultMetrics = () => {
    if (defaultsStarted) return;
    collectDefaultMetrics({ register, prefix: 'kivo_' });
    defaultsStarted = true;
};

export const httpRequestsTotal = new Counter({
    name: 'kivo_http_requests_total',
    help: 'Total HTTP requests handled by kivo',
    labelNames: ['method', 'path', 'status'] as const,
    registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
    name: 'kivo_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
});

export const authAttemptsTotal = new Counter({
    name: 'kivo_auth_attempts_total',
    help: 'Authentication attempts by endpoint and outcome',
    labelNames: ['endpoint', 'outcome'] as const,
    registers: [register],
});

export const registrationsTotal = new Counter({
    name: 'kivo_registrations_total',
    help: 'User registration attempts by outcome',
    labelNames: ['outcome'] as const,
    registers: [register],
});

export const rateLimitHitsTotal = new Counter({
    name: 'kivo_rate_limit_hits_total',
    help: 'Requests rejected by global rate limiter',
    registers: [register],
});

// Low-cardinality path set — anything outside this is grouped as 'other'
// so a flood of 404s can't explode metric series.
const KNOWN_PATHS = new Set([
    '/health',
    '/metrics',
    '/login',
    '/register',
    '/refresh',
    '/verify',
    '/logout',
    '/search',
    '/users',
]);

export const normalizePath = (path: string): string => {
    if (KNOWN_PATHS.has(path)) return path;
    return 'other';
};

export const metricsRegister = register;
