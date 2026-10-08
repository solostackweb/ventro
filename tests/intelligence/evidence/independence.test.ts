import { calculateIndependentSourceCount, areSourcesIndependent, getUniqueIndependenceGroups } from '@/lib/intelligence/evidence/independence';

describe('calculateIndependentSourceCount', () => {
  test('counts official sources', () => {
    const sources = [
      { sourceId: 'a', independenceGroup: 'g1', domain: 'd1.com', isOfficial: true },
      { sourceId: 'b', independenceGroup: 'g2', domain: 'd2.com', isOfficial: false },
    ];
    const result = calculateIndependentSourceCount(sources);
    expect(result.officialCount).toBe(1);
    expect(result.independentCount).toBe(2);
  });

  test('uses independence_group when present', () => {
    const sources = [
      { sourceId: 'a', independenceGroup: 'techcrunch', domain: 'techcrunch.com', isOfficial: false },
      { sourceId: 'b', independenceGroup: 'techcrunch', domain: 'techcrunch.com', isOfficial: false },
      { sourceId: 'c', independenceGroup: 'venturebeat', domain: 'venturebeat.com', isOfficial: false },
    ];
    const result = calculateIndependentSourceCount(sources);
    expect(result.independentCount).toBe(2);
    expect(result.groups).toContain('techcrunch');
    expect(result.groups).toContain('venturebeat');
  });

  test('falls back to domain when independence_group absent', () => {
    const sources = [
      { sourceId: 'a', independenceGroup: null, domain: 'techcrunch.com', isOfficial: false },
      { sourceId: 'b', independenceGroup: null, domain: 'venturebeat.com', isOfficial: false },
    ];
    const result = calculateIndependentSourceCount(sources);
    expect(result.independentCount).toBe(2);
    expect(result.groups).toContain('techcrunch.com');
  });
});

describe('areSourcesIndependent', () => {
  test('returns true for different groups', () => {
    const a = { sourceId: 'a', independenceGroup: 'g1', domain: 'd1.com', isOfficial: false };
    const b = { sourceId: 'b', independenceGroup: 'g2', domain: 'd2.com', isOfficial: false };
    expect(areSourcesIndependent(a, b)).toBe(true);
  });

  test('returns false for same group', () => {
    const a = { sourceId: 'a', independenceGroup: 'g1', domain: 'd1.com', isOfficial: false };
    const b = { sourceId: 'b', independenceGroup: 'g1', domain: 'd2.com', isOfficial: false };
    expect(areSourcesIndependent(a, b)).toBe(false);
  });

  test('falls back to domain comparison', () => {
    const a = { sourceId: 'a', independenceGroup: null, domain: 'd1.com', isOfficial: false };
    const b = { sourceId: 'b', independenceGroup: null, domain: 'd2.com', isOfficial: false };
    expect(areSourcesIndependent(a, b)).toBe(true);
  });
});

describe('getUniqueIndependenceGroups', () => {
  test('returns unique groups', () => {
    const sources = [
      { sourceId: 'a', independenceGroup: 'g1', domain: 'd1.com', isOfficial: false },
      { sourceId: 'b', independenceGroup: 'g1', domain: 'd2.com', isOfficial: false },
      { sourceId: 'c', independenceGroup: 'g2', domain: 'd3.com', isOfficial: false },
    ];
    const groups = getUniqueIndependenceGroups(sources);
    expect(groups).toEqual(['g1', 'g2']);
  });

  test('handles null groups', () => {
    const sources = [
      { sourceId: 'a', independenceGroup: null, domain: 'd1.com', isOfficial: false },
      { sourceId: 'b', independenceGroup: null, domain: 'd2.com', isOfficial: false },
    ];
    const groups = getUniqueIndependenceGroups(sources);
    expect(groups).toEqual(['d1.com', 'd2.com']);
  });
});