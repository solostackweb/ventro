import { canonicalizeUrl } from '@/lib/intelligence/evidence/canonical-url';

describe('canonicalizeUrl', () => {
  test('normalizes protocol to https', () => {
    const result = canonicalizeUrl('http://example.com/path');
    expect(result.canonicalUrl).toBe('https://example.com/path');
  });

  test('removes www prefix', () => {
    const result = canonicalizeUrl('https://www.example.com/path');
    expect(result.canonicalUrl).toBe('https://example.com/path');
  });

  test('removes default ports', () => {
    const result = canonicalizeUrl('https://example.com:443/path');
    expect(result.canonicalUrl).toBe('https://example.com/path');
  });

  test('strips tracking parameters', () => {
    const result = canonicalizeUrl('https://example.com/path?utm_source=test&utm_medium=email&real=value');
    expect(result.canonicalUrl).toBe('https://example.com/path?real=value');
  });

  test('sorts query parameters', () => {
    const result = canonicalizeUrl('https://example.com/path?z=1&a=2');
    expect(result.canonicalUrl).toBe('https://example.com/path?a=2&z=1');
  });

  test('removes fragments', () => {
    const result = canonicalizeUrl('https://example.com/path#section');
    expect(result.canonicalUrl).toBe('https://example.com/path');
  });

  test('removes trailing slash from non-root paths', () => {
    const result = canonicalizeUrl('https://example.com/path/');
    expect(result.canonicalUrl).toBe('https://example.com/path');
  });

  test('preserves root path slash', () => {
    const result = canonicalizeUrl('https://example.com/');
    expect(result.canonicalUrl).toBe('https://example.com/');
  });

  test('produces stable hash for same canonical URL', () => {
    const result1 = canonicalizeUrl('https://example.com/path?b=2&a=1');
    const result2 = canonicalizeUrl('https://example.com/path?a=1&b=2');
    expect(result1.urlHash).toBe(result2.urlHash);
  });

  test('extracts domain correctly', () => {
    const result = canonicalizeUrl('https://www.Example.COM/path');
    expect(result.domain).toBe('example.com');
  });

  test('throws on invalid URL', () => {
    expect(() => canonicalizeUrl('not-a-url')).toThrow('Invalid URL');
  });

  test('handles complex URL with multiple tracking params', () => {
    const result = canonicalizeUrl(
      'https://www.techcrunch.com/2024/01/15/ai-startup-raises-100m/?utm_source=twitter&utm_medium=social&fbclid=123&ref=homepage#comments'
    );
    expect(result.canonicalUrl).toBe('https://techcrunch.com/2024/01/15/ai-startup-raises-100m');
    expect(result.domain).toBe('techcrunch.com');
  });
});