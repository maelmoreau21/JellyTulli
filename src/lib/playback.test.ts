import { describe, it, expect } from 'vitest';
import { clampDuration } from './utils';

describe('clampDuration', () => {
    it('should return 0 for negative duration', () => {
        expect(clampDuration(-10, 100000)).toBe(0);
    });

    it('should return 0 for zero duration', () => {
        expect(clampDuration(0, 100000)).toBe(0);
    });

    it('should not clamp if duration is within limits', () => {
        // 50s watched, 100s media
        expect(clampDuration(50, 100000)).toBe(50);
    });

    it('should clamp to media duration + 10s buffer', () => {
        // 120s watched, 100s media (100000ms)
        expect(clampDuration(120, 100000)).toBe(110);
    });

    it('should use 24h cap if media duration is unknown', () => {
        // 100,000s watched (~27h), unknown media
        expect(clampDuration(100000, null)).toBe(86400);
    });

    it('should handle BigInt media duration', () => {
        expect(clampDuration(50, BigInt(100000))).toBe(50);
        expect(clampDuration(120, BigInt(100000))).toBe(110);
    });
});
