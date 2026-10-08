/**
 * Source independence calculation for publication policy.
 * Pure function — uses explicit independence_group, falls back to domain.
 */

export interface SourceIdentity {
  sourceId: string;
  independenceGroup: string | null;
  domain: string;
  isOfficial: boolean;
}

export function calculateIndependentSourceCount(sources: SourceIdentity[]): {
  officialCount: number;
  independentCount: number;
  groups: string[];
} {
  let officialCount = 0;
  const groups = new Set<string>();

  for (const source of sources) {
    if (source.isOfficial) {
      officialCount++;
    }
    const groupKey = source.independenceGroup ?? source.domain;
    if (groupKey) {
      groups.add(groupKey);
    }
  }

  return {
    officialCount,
    independentCount: groups.size,
    groups: Array.from(groups),
  };
}

export function areSourcesIndependent(
  sourceA: SourceIdentity,
  sourceB: SourceIdentity
): boolean {
  const groupA = sourceA.independenceGroup ?? sourceA.domain;
  const groupB = sourceB.independenceGroup ?? sourceB.domain;
  return groupA !== groupB;
}

export function getUniqueIndependenceGroups(sources: SourceIdentity[]): string[] {
  const groups = new Set<string>();
  for (const source of sources) {
    const groupKey = source.independenceGroup ?? source.domain;
    if (groupKey) groups.add(groupKey);
  }
  return Array.from(groups);
}