import { describe, expect, it } from 'bun:test';
import { durationToSeconds } from '../src/lib/utils/duration';

describe('durationToSeconds', () => {
    it('parses units and plain numbers', () => {
        expect(durationToSeconds('15m')).toBe(900);
        expect(durationToSeconds('1d')).toBe(86400);
        expect(durationToSeconds('2W')).toBe(1209600);
        expect(durationToSeconds('90')).toBe(90);
        expect(durationToSeconds(30)).toBe(30);
    });

    it('rejects unsupported formats', () => {
        expect(() => durationToSeconds('soon')).toThrow();
        expect(() => durationToSeconds('1y')).toThrow();
    });
});
