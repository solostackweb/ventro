import { equalPreviousWindow, fingerprint, normalizeAnswerFilters } from '@/lib/intelligence/answers/filters';
import { filters } from './fixtures';

describe('answer filters', () => {
  it('normalizes, deduplicates, and sorts dimensions', () => {
    const value = normalizeAnswerFilters({ ...filters, domains: ['Agents', 'agents', 'Infra'], stages: ['seed', 'Seed'] });
    expect(value.domains).toEqual(['agents', 'infra']);
    expect(value.stages).toEqual(['seed']);
  });

  it('rejects an inverted or overly broad window', () => {
    expect(() => normalizeAnswerFilters({ ...filters, periodStart: filters.periodEnd, periodEnd: filters.periodStart })).toThrow();
    expect(() => normalizeAnswerFilters({ ...filters, periodStart: '2020-01-01T00:00:00.000Z' })).toThrow('730');
  });

  it('uses an exactly equal previous window', () => {
    const previous = equalPreviousWindow(filters);
    expect(new Date(previous.end).getTime() - new Date(previous.start).getTime())
      .toBe(new Date(filters.periodEnd).getTime() - new Date(filters.periodStart).getTime());
    expect(previous.end).toBe(filters.periodStart);
  });

  it('produces order-independent deterministic fingerprints', () => {
    expect(fingerprint({ b: 2, a: 1 })).toBe(fingerprint({ a: 1, b: 2 }));
    expect(fingerprint({ a: 1 })).toHaveLength(64);
  });
});
