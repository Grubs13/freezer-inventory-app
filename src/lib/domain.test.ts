import { describe, expect, it } from 'vitest';
import { bestBy, freshness } from './domain';

describe('freshness', () => {
  it('uses the category freezer life when no best-by was set', () => {
    expect(bestBy('poultry', { frozenOn: '2026-01-10', bestBy: null })).toBe('2026-10-10');
    expect(freshness('2026-01-10', '2026-10-10', '2026-03-01')).toBe('fresh');
    expect(freshness('2026-01-10', '2026-10-10', '2026-08-15')).toBe('soon');
    expect(freshness('2026-01-10', '2026-10-10', '2026-10-11')).toBe('expired');
  });

  it('prefers a best-by someone set on the pack', () => {
    const set = bestBy('poultry', { frozenOn: '2026-01-10', bestBy: '2026-02-01' });
    expect(set).toBe('2026-02-01');
    expect(freshness('2026-01-10', set, '2026-01-28')).toBe('soon');
    expect(freshness('2026-01-10', set, '2026-02-02')).toBe('expired');
  });

  it('treats a best-by on the day it went in as use soon, then past best', () => {
    expect(freshness('2026-01-10', '2026-01-10', '2026-01-10')).toBe('soon');
    expect(freshness('2026-01-10', '2026-01-10', '2026-01-11')).toBe('expired');
  });
});
