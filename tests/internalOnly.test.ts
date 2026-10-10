import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { internalOnly } from '../src/middleware/internalOnly';

describe('internalOnly', () => {
    const app = new Hono();
    app.get('/metrics', internalOnly, (c) => c.text('ok'));

    it('allows direct in-cluster requests', async () => {
        expect((await app.request('/metrics')).status).toBe(200);
    });

    it('returns 404 for requests that came through Cloudflare', async () => {
        const response = await app.request('/metrics', { headers: { 'cf-connecting-ip': '203.0.113.7' } });

        expect(response.status).toBe(404);
    });
});
