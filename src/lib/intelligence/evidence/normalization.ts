import { createHash } from 'crypto';

/**
 * Versioned text normalization for immutable document versions.
 * Pure functions — deterministic, no side effects.
 */

export const NORMALIZATION_VERSION = 1;

export interface NormalizedTextResult {
  normalizedText: string;
  checksum: string;
}

const WHITESPACE_RE = /\s+/g;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

export function normalizeText(rawText: string, version: number = NORMALIZATION_VERSION): NormalizedTextResult {
  if (version !== 1) {
    throw new Error(`Unsupported normalization version: ${version}`);
  }

  let text = rawText;

  text = text.replace(CONTROL_CHAR_RE, '');
  text = text.replace(ZERO_WIDTH_RE, '');
  text = text.replace(WHITESPACE_RE, ' ');
  text = text.trim();

  const checksum = sha256HexSync(text);

  return { normalizedText: text, checksum };
}

function sha256HexSync(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function computeContentHash(rawContent: string): string {
  return createHash('sha256').update(rawContent).digest('hex');
}