import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount === null || amount === undefined) return 'Not disclosed';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return 'Unknown date';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });
  } catch {
    return 'Invalid date';
  }
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatRelativeTime(date: string | null): string {
  if (!date) return 'Unknown';
  try {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  } catch {
    return 'Unknown';
  }
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '…';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isMastersUnionEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === 'mastersunion.org';
}

export function getEntitlementLabel(entitlement: string): string {
  switch (entitlement) {
    case 'preview':
      return 'Preview';
    case 'discount_card':
      return '10-Day Access';
    case 'subscribed':
      return 'Subscribed';
    default:
      return 'Unknown';
  }
}

export function getVerificationLabel(status: string): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'partial':
      return 'Partial';
    case 'unverified':
      return 'Unverified';
    case 'conflicted':
      return 'Conflicted';
    default:
      return 'Unknown';
  }
}

export function getVerificationColor(status: string): string {
  switch (status) {
    case 'verified':
      return 'badge-verified';
    case 'partial':
      return 'badge-partial';
    case 'unverified':
      return 'badge-unverified';
    case 'conflicted':
      return 'badge-conflicted';
    default:
      return 'badge-unverified';
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number; backoff?: number } = { retries: 3, delay: 1000 }
): Promise<T> {
  return fn().catch((err) => {
    if (options.retries <= 0) throw err;
    return sleep(options.delay).then(() =>
      retry(fn, {
        retries: options.retries - 1,
        delay: options.backoff ? options.delay * options.backoff : options.delay,
        backoff: options.backoff,
      })
    );
  });
}

export function parseRSSDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isSameEntity(name1: string, name2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w]/g, '');
  return normalize(name1) === normalize(name2);
}
