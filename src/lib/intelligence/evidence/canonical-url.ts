import { createHash } from 'crypto';

/**
 * Canonical URL normalization for stable document identity.
 * Pure function — no side effects, no external dependencies.
 */

export interface CanonicalUrlResult {
  canonicalUrl: string;
  urlHash: string;
  domain: string;
}

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'campaign',
  '_ga', '_gl', 'mc_cid', 'mc_eid', 'nr_email_referer',
]);

const FRAGMENT_PATTERNS = [
  /^#/,
  /^#:~:text=/,
];

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAMS.has(key.toLowerCase());
}

function stripFragment(url: URL): void {
  for (const pattern of FRAGMENT_PATTERNS) {
    if (pattern.test(url.hash)) {
      url.hash = '';
      break;
    }
  }
}

export function canonicalizeUrl(rawUrl: string): CanonicalUrlResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  const originalHost = url.hostname;
  const domain = normalizeHostname(originalHost);

  url.protocol = 'https:';
  url.hostname = domain;

  if ((url.protocol === 'https:' && url.port === '443') ||
      (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }

  const paramsToDelete: string[] = [];
  url.searchParams.forEach((_, key) => {
    if (isTrackingParam(key)) {
      paramsToDelete.push(key);
    }
  });
  for (const key of paramsToDelete) {
    url.searchParams.delete(key);
  }

  const sortedParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [key, value] of sortedParams) {
    url.searchParams.append(key, value);
  }

  stripFragment(url);

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const canonicalUrl = url.toString();
  const urlHash = sha256HexSync(canonicalUrl);

  return { canonicalUrl, urlHash, domain };
}

function sha256HexSync(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}