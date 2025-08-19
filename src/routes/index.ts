import Router from 'koa-router';

import { login } from './login';
import { logout } from './logout';
import { refresh } from './refresh';
import { register } from './register';
import { search } from './search';
import { searchRateLimitMiddleware, searchSecurityMiddleware } from './search/middleware';
import { verify } from './verify';

const router = new Router();

router.get('/health', async (ctx) => {
    ctx.status = 200;
    ctx.body = { status: 'healthy', service: 'kivo', timestamp: new Date().toISOString() };
});

router.post('/login', login);
router.post('/register', register);
router.get('/search', searchSecurityMiddleware, searchRateLimitMiddleware, search);
router.get('/verify', verify);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
