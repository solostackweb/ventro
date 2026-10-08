export function snapshotFreshnessStatus(
  storedStatus: 'computing' | 'published' | 'stale' | 'failed' | 'superseded',
  staleAfter: string,
  now = new Date(),
): 'computing' | 'published' | 'stale' | 'failed' | 'superseded' {
  if (storedStatus === 'published' && new Date(staleAfter).getTime() <= now.getTime()) return 'stale';
  return storedStatus;
}
