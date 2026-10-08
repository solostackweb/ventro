import { normalizeText, computeContentHash, NORMALIZATION_VERSION } from '@/lib/intelligence/evidence/normalization';

describe('normalizeText', () => {
  test('collapses whitespace', () => {
    const { normalizedText } = normalizeText('Hello    world\n\n\tagain');
    expect(normalizedText).toBe('Hello world again');
  });

  test('trims leading and trailing whitespace', () => {
    const { normalizedText } = normalizeText('  Hello world  ');
    expect(normalizedText).toBe('Hello world');
  });

  test('removes control characters', () => {
    const { normalizedText } = normalizeText('Hello\x00world\x1F');
    expect(normalizedText).toBe('Helloworld');
  });

  test('removes zero-width characters', () => {
    const { normalizedText } = normalizeText('Hello\u200Bworld\uFEFF');
    expect(normalizedText).toBe('Helloworld');
  });

  test('produces stable checksum for same input', () => {
    const r1 = normalizeText('Hello world');
    const r2 = normalizeText('Hello world');
    expect(r1.checksum).toBe(r2.checksum);
  });

  test('produces different checksum for different input', () => {
    const r1 = normalizeText('Hello world');
    const r2 = normalizeText('Hello world!');
    expect(r1.checksum).not.toBe(r2.checksum);
  });

  test('throws on unsupported version', () => {
    expect(() => normalizeText('test', 2)).toThrow('Unsupported normalization version');
  });

  test('returns correct version', () => {
    expect(NORMALIZATION_VERSION).toBe(1);
  });
});

describe('computeContentHash', () => {
  test('produces stable SHA-256 hash', () => {
    const h1 = computeContentHash('test content');
    const h2 = computeContentHash('test content');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  test('produces different hash for different content', () => {
    const h1 = computeContentHash('content a');
    const h2 = computeContentHash('content b');
    expect(h1).not.toBe(h2);
  });
});