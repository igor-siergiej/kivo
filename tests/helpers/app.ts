import { Hono } from 'hono';
import { login } from '../../src/routes/login';
import { logout } from '../../src/routes/logout';
import { refresh } from '../../src/routes/refresh';
import { register } from '../../src/routes/register';
import { search } from '../../src/routes/search';
import { getUsersByUsernames } from '../../src/routes/users';
import { verify } from '../../src/routes/verify';

export const buildApp = () => {
    const app = new Hono();
    app.post('/login', login);
    app.post('/register', register);
    app.post('/refresh', refresh);
    app.get('/verify', verify);
    app.post('/logout', logout);
    app.get('/search', search);
    app.post('/users', getUsersByUsernames);
    return app;
};

export const postJson = (app: Hono, path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });

export const refreshCookie = (response: Response) => (response.headers.get('set-cookie') ?? '').split(';')[0];
