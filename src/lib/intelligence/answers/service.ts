import { buildBothAnswerDrafts } from './aggregations';
import { composeAnswer, rankSectionsForPreferences, validateDraft } from './composer';
import { fingerprint } from './filters';
import {
  getLatestAnswerSnapshot,
  loadAnswerInputBundle,
  persistAnswerSnapshot,
} from './repository';
import type {
  AnswerFilters,
  AnswerSnapshotRecord,
  NarrationProvider,
  UserAnswerPreferences,
} from './types';

export async function recomputeAnswerSnapshots(
  filters: AnswerFilters,
  options: { narrator?: NarrationProvider; now?: Date } = {},
): Promise<Array<{ id: string; kind: string; narrationMode: string; narrationError?: string }>> {
  const bundle = await loadAnswerInputBundle(filters);
  const drafts = buildBothAnswerDrafts(filters, bundle, options.now ?? new Date());
  const results = [];
  for (const deterministicDraft of drafts) {
    const composed = await composeAnswer(deterministicDraft, options.narrator);
    validateDraft(composed.draft);
    const id = await persistAnswerSnapshot(composed.draft);
    results.push({ id, kind: composed.draft.kind, narrationMode: composed.narrationMode, narrationError: composed.narrationError });
  }
  return results;
}

export async function getBothLatestAnswers(
  filters: AnswerFilters,
  preferences?: UserAnswerPreferences,
): Promise<{ investingNow: AnswerSnapshotRecord | null; marketDemand: AnswerSnapshotRecord | null }> {
  const filterFingerprint = fingerprint(filters);
  const [investingNow, marketDemand] = await Promise.all([
    getLatestAnswerSnapshot('investing_now', filterFingerprint),
    getLatestAnswerSnapshot('market_demand', filterFingerprint),
  ]);
  const personalize = (snapshot: AnswerSnapshotRecord | null) => snapshot && preferences
    ? { ...snapshot, sections: rankSectionsForPreferences(snapshot.sections, preferences) }
    : snapshot;
  return { investingNow: personalize(investingNow), marketDemand: personalize(marketDemand) };
}
