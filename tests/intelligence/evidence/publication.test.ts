import { evaluatePublication, PUBLICATION_THRESHOLDS } from '@/lib/intelligence/evidence/publication';

describe('evaluatePublication', () => {
  const baseSources = [
    { isOfficial: true, independenceGroup: 'techcrunch', domain: 'techcrunch.com' },
    { isOfficial: false, independenceGroup: 'venturebeat', domain: 'venturebeat.com' },
  ];

  test('publishes with one official source above thresholds', () => {
    const result = evaluatePublication({
      evidenceSources: [{ isOfficial: true, independenceGroup: 'official', domain: 'company.com' }],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.95,
      hasContradiction: false,
    });
    expect(result.status).toBe('published');
    expect(result.officialCount).toBe(1);
    expect(result.reason).toContain('meets conservative evidence threshold');
  });

  test('publishes with two independent sources above thresholds', () => {
    const result = evaluatePublication({
      evidenceSources: [
        { isOfficial: false, independenceGroup: 'techcrunch', domain: 'techcrunch.com' },
        { isOfficial: false, independenceGroup: 'venturebeat', domain: 'venturebeat.com' },
      ],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.95,
      hasContradiction: false,
    });
    expect(result.status).toBe('published');
    expect(result.independentCount).toBe(2);
  });

  test('blocks when extraction confidence below 0.85', () => {
    const result = evaluatePublication({
      evidenceSources: [{ isOfficial: true, independenceGroup: 'official', domain: 'company.com' }],
      extractionConfidence: 0.84,
      resolutionConfidence: 0.95,
      hasContradiction: false,
    });
    expect(result.status).toBe('candidate');
    expect(result.reason).toContain('extraction confidence 0.84 < 0.85');
  });

  test('blocks when resolution confidence below 0.90', () => {
    const result = evaluatePublication({
      evidenceSources: [{ isOfficial: true, independenceGroup: 'official', domain: 'company.com' }],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.89,
      hasContradiction: false,
    });
    expect(result.status).toBe('candidate');
    expect(result.reason).toContain('resolution confidence 0.89 < 0.90');
  });

  test('blocks when active contradiction exists', () => {
    const result = evaluatePublication({
      evidenceSources: [{ isOfficial: true, independenceGroup: 'official', domain: 'company.com' }],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.95,
      hasContradiction: true,
    });
    expect(result.status).toBe('candidate');
    expect(result.reason).toContain('active contradictory evidence exists');
  });

  test('blocks with only one non-official source', () => {
    const result = evaluatePublication({
      evidenceSources: [{ isOfficial: false, independenceGroup: 'techcrunch', domain: 'techcrunch.com' }],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.95,
      hasContradiction: false,
    });
    expect(result.status).toBe('candidate');
    expect(result.reason).toContain('insufficient source support');
  });

  test('counts same independence group once', () => {
    const result = evaluatePublication({
      evidenceSources: [
        { isOfficial: false, independenceGroup: 'techcrunch', domain: 'techcrunch.com' },
        { isOfficial: false, independenceGroup: 'techcrunch', domain: 'techcrunch.com' },
      ],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.95,
      hasContradiction: false,
    });
    expect(result.independentCount).toBe(1);
    expect(result.status).toBe('candidate');
  });

  test('falls back to domain when independence group absent', () => {
    const result = evaluatePublication({
      evidenceSources: [
        { isOfficial: false, independenceGroup: null, domain: 'techcrunch.com' },
        { isOfficial: false, independenceGroup: null, domain: 'venturebeat.com' },
      ],
      extractionConfidence: 0.9,
      resolutionConfidence: 0.95,
      hasContradiction: false,
    });
    expect(result.independentCount).toBe(2);
    expect(result.status).toBe('published');
  });

  test('exposes thresholds as constants', () => {
    expect(PUBLICATION_THRESHOLDS.EXTRACTION_CONFIDENCE).toBe(0.85);
    expect(PUBLICATION_THRESHOLDS.RESOLUTION_CONFIDENCE).toBe(0.90);
  });
});