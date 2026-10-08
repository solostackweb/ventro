import { validateSpan, findExactSpan, createEvidenceItem } from '@/lib/intelligence/evidence/spans';

describe('validateSpan', () => {
  const text = 'The company raised $10M in Series A funding from Sequoia Capital.';

  test('validates correct span', () => {
    const span = {
      start: 19,
      end: 23,
      excerpt: '$10M',
      checksum: '1b41d2aa2497d0d1fb8faaf71e69c8040073e021e82c1388478f6b5eef2c1698', // sha256('$10M')
    };
    const result = validateSpan(text, span);
    expect(result.valid).toBe(true);
  });

  test('rejects negative start', () => {
    const span = { start: -1, end: 5, excerpt: 'The', checksum: 'abc' };
    const result = validateSpan(text, span);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('span_start');
  });

  test('rejects end beyond text length', () => {
    const span = { start: 10, end: 1000, excerpt: 'long', checksum: 'abc' };
    const result = validateSpan(text, span);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('span_end');
  });

  test('rejects start >= end', () => {
    const span = { start: 10, end: 5, excerpt: 'bad', checksum: 'abc' };
    const result = validateSpan(text, span);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('span_start');
  });

  test('rejects excerpt mismatch', () => {
    const span = { start: 19, end: 23, excerpt: '$20M', checksum: 'abc' };
    const result = validateSpan(text, span);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Excerpt mismatch');
  });

  test('rejects checksum mismatch', () => {
    const span = { start: 19, end: 23, excerpt: '$10M', checksum: 'wrong' };
    const result = validateSpan(text, span);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Checksum mismatch');
  });
});

describe('findExactSpan', () => {
  const text = 'The company raised $10M in Series A funding from Sequoia Capital.';

  test('finds exact match', () => {
    const span = findExactSpan(text, '$10M');
    expect(span).not.toBeNull();
    expect(span?.excerpt).toBe('$10M');
    expect(span?.start).toBe(19);
    expect(span?.end).toBe(23);
  });

  test('returns null for missing text', () => {
    const span = findExactSpan(text, '$100M');
    expect(span).toBeNull();
  });

  test('finds first occurrence', () => {
    const text2 = 'Sequoia invested. Sequoia led the round.';
    const span = findExactSpan(text2, 'Sequoia');
    expect(span?.start).toBe(0);
  });
});

describe('createEvidenceItem', () => {
  test('creates evidence item with all fields', () => {
    const span = {
      start: 10,
      end: 15,
      excerpt: 'hello',
      checksum: 'abc123',
    };
    const item = createEvidenceItem('doc-version-123', span, 'supports', 0.9);
    
    expect(item.document_version_id).toBe('doc-version-123');
    expect(item.stance).toBe('supports');
    expect(item.span_start).toBe(10);
    expect(item.span_end).toBe(15);
    expect(item.excerpt).toBe('hello');
    expect(item.excerpt_checksum).toBe('abc123');
    expect(item.extractor_confidence).toBe(0.9);
  });

  test('defaults stance to supports', () => {
    const span = { start: 0, end: 5, excerpt: 'test', checksum: 'abc' };
    const item = createEvidenceItem('doc-1', span);
    expect(item.stance).toBe('supports');
  });

  test('defaults confidence to 1.0', () => {
    const span = { start: 0, end: 5, excerpt: 'test', checksum: 'abc' };
    const item = createEvidenceItem('doc-1', span);
    expect(item.extractor_confidence).toBe(1.0);
  });
});