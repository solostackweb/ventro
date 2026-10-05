import type { ReusePermission } from '@/types';

type MediaValue = { $?: { url?: string; medium?: string; type?: string } } | Array<{ $?: { url?: string; medium?: string; type?: string } }>;

interface FeedPresentationItem {
  enclosure?: { url?: string; type?: string };
  contentSnippet?: string;
  content?: string;
  summary?: string;
  description?: string;
  'media:content'?: MediaValue;
  'media:thumbnail'?: MediaValue;
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function mediaUrl(value: MediaValue | undefined): string | null {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  for (const item of items) {
    const attrs = item?.$;
    if (attrs?.medium && attrs.medium !== 'image') continue;
    if (attrs?.type && !attrs.type.startsWith('image/')) continue;
    const url = safeImageUrl(attrs?.url);
    if (url) return url;
  }
  return null;
}

function readableExcerpt(value: string): string {
  const plain = value.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim();
  if (plain.length <= 500) return plain;
  const cut = plain.slice(0, 500);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 350)).trimEnd()}…`;
}

export function presentFeedItem(item: FeedPresentationItem, permission: ReusePermission) {
  const enclosure = item.enclosure?.type?.startsWith('image/')
    ? safeImageUrl(item.enclosure.url) : null;
  const imageUrl = mediaUrl(item['media:thumbnail'])
    || mediaUrl(item['media:content']) || enclosure;
  const canExcerpt = permission === 'full_text' || permission === 'summary_only';
  const sourceText = item.contentSnippet || item.summary || item.description
    || (permission === 'full_text' ? item.content : '') || '';
  return {
    imageUrl,
    excerpt: canExcerpt ? readableExcerpt(sourceText) : '',
  };
}
