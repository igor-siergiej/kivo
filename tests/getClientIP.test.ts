import { describe, expect, it } from 'bun:test';
import { getClientIP } from '../src/lib/utils/getClientIP';

const requestWith = (headers: Record<string, string>) => new Request('http://kivo/health', { headers });

describe('getClientIP', () => {
    it('prefers the Cloudflare header over a client-supplied x-forwarded-for', () => {
        const request = requestWith({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });

        expect(getClientIP(request)).toBe('203.0.113.7');
    });

    it('uses the last x-forwarded-for hop so spoofed leading entries are ignored', () => {
        expect(getClientIP(requestWith({ 'x-forwarded-for': '6.6.6.6, 198.51.100.9' }))).toBe('198.51.100.9');
    });

    it('falls back to x-real-ip then unknown', () => {
        expect(getClientIP(requestWith({ 'x-real-ip': '192.0.2.1' }))).toBe('192.0.2.1');
        expect(getClientIP(requestWith({}))).toBe('unknown');
    });
});
