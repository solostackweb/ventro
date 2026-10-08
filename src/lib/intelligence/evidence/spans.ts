import { createHash } from 'crypto';

/**
 * Exact span discovery and validation against normalized text.
 * Pure functions — offsets are zero-based, start-inclusive, end-exclusive.
 */

export interface EvidenceSpan {
  start: number;
  end: number;
  excerpt: string;
  checksum: string;
}

export interface SpanValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSpan(
  normalizedText: string,
  span: EvidenceSpan
): SpanValidationResult {
  if (span.start < 0) {
    return { valid: false, error: `span_start ${span.start} < 0` };
  }
  if (span.end > normalizedText.length) {
    return { valid: false, error: `span_end ${span.end} > text length ${normalizedText.length}` };
  }
  if (span.start >= span.end) {
    return { valid: false, error: `span_start ${span.start} >= span_end ${span.end}` };
  }

  const actualExcerpt = normalizedText.slice(span.start, span.end);
  if (actualExcerpt !== span.excerpt) {
    return { valid: false, error: `Excerpt mismatch at [${span.start}, ${span.end})` };
  }

  const expectedChecksum = sha256HexSync(span.excerpt);
  if (expectedChecksum !== span.checksum) {
    return { valid: false, error: `Checksum mismatch: expected ${expectedChecksum}, got ${span.checksum}` };
  }

  return { valid: true };
}

export function findSpans(
  normalizedText: string,
  patterns: Array<{ pattern: RegExp; extractorConfidence: number }>
): EvidenceSpan[] {
  const spans: EvidenceSpan[] = [];

  for (const { pattern, extractorConfidence } of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalizedText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const excerpt = match[0];
      const checksum = sha256HexSync(excerpt);

      spans.push({
        start,
        end,
        excerpt,
        checksum,
      });
    }
  }

  return spans;
}

export function findExactSpan(
  normalizedText: string,
  searchText: string,
  extractorConfidence: number = 1.0
): EvidenceSpan | null {
  const index = normalizedText.indexOf(searchText);
  if (index === -1) return null;

  return {
    start: index,
    end: index + searchText.length,
    excerpt: searchText,
    checksum: sha256HexSync(searchText),
  };
}

function sha256HexSync(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface SpanWithMetadata extends EvidenceSpan {
  extractorConfidence: number;
  stance: 'supports' | 'contradicts' | 'context';
}

export function createEvidenceItem(
  documentVersionId: string,
  span: EvidenceSpan,
  stance: 'supports' | 'contradicts' | 'context' = 'supports',
  extractorConfidence: number = 1.0
) {
  return {
    document_version_id: documentVersionId,
    stance,
    span_start: span.start,
    span_end: span.end,
    excerpt: span.excerpt,
    excerpt_checksum: span.checksum,
    extractor_confidence: extractorConfidence,
  };
}