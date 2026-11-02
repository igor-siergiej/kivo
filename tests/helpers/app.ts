import { Logger } from '@imapps/api-utils';
import { Hono } from 'hono';
import { z } from 'zod';

import { getSigningKeys } from '../../src/lib/auth/keys';
import { createErrorHandler } from '../../src/lib/errors/handler';
import { requireLookupAuth } from '../../src/middleware/lookupAuth';
import { login } from '../../src/routes/login';
import { logout, logoutAll } from '../../src/routes/logout';
import { refresh } from '../../src/routes/refresh';
import { register } from '../../src/routes/register';
import { getUsersByUsernames } from '../../src/routes/users';
import { verify } from '../../src/routes/verify';

export class SilentLogger extends Logger {
    override error = () => {};
}

export const buildApp = () => {
    const app = new Hono();
    app.onError(createErrorHandler(new SilentLogger()));
    app.post('/login', login);
    app.post('/register', register);
    app.post('/refresh', refresh);
    app.get('/verify', verify);
    app.get('/.well-known/jwks.json', (c) => c.json({ keys: getSigningKeys() ? [getSigningKeys()?.jwk] : [] }));
    app.post('/logout', logout);
    app.post('/logout-all', logoutAll);
    app.post('/users', requireLookupAuth({ allowServiceToken: true }), getUsersByUsernames);

    return app;
};

type RequestBody = z.infer<ReturnType<typeof z.json>>;

export const postJson = (app: Hono, path: string, body: RequestBody, headers: Record<string, string> = {}) =>
    app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });

export const refreshCookie = (response: Response) => (response.headers.get('set-cookie') ?? '').split(';')[0];

const optionalString = z.string().optional();

const namedUser = z.object({ id: z.string(), username: z.string() });

// Only the fields tests assert on are typed; anything else in the body is kept as-is for whole-body comparisons.
const responseBodySchema = z.looseObject({
    success: z.boolean().optional(),
    message: optionalString,
    status: optionalString,
    service: optionalString,
    accessToken: optionalString,
    payload: namedUser.optional(),
    users: z.array(namedUser).optional(),
    notFoundUsernames: z.array(z.string()).optional(),
    keys: z.array(z.looseObject({ kid: optionalString, d: optionalString })).optional(),
});

export const jsonBody = async (response: Response) => responseBodySchema.parse(await response.json());
