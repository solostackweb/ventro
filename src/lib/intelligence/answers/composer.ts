import type {
  AnswerCitation,
  AnswerSection,
  AnswerSnapshotDraft,
  NarrationProvider,
  UserAnswerPreferences,
} from './types';

export interface CitationCompleteness {
  materialSections: number;
  citedMaterialSections: number;
  ratio: number;
  missingSectionKeys: string[];
}

export interface AnswerEvaluation {
  citationCompleteness: number;
  citationFaithfulness: number;
  citedTargets: number;
  unsupportedTargets: string[];
  passed: boolean;
}

export function citationCompleteness(draft: AnswerSnapshotDraft): CitationCompleteness {
  const material = draft.sections.filter(section => section.material);
  const cited = material.filter(section => section.citations.length > 0);
  return {
    materialSections: material.length,
    citedMaterialSections: cited.length,
    ratio: material.length === 0 ? 1 : cited.length / material.length,
    missingSectionKeys: material.filter(section => section.citations.length === 0).map(section => section.key),
  };
}

function hasNormalizedTarget(citation: AnswerCitation): boolean {
  return Boolean(
    citation.claimId || citation.claimBindingId || citation.claimEvidenceId || citation.fundingRoundId ||
    citation.roundParticipantId || citation.thesisRecordId || citation.patternId,
  );
}

export function citationTarget(citation: AnswerCitation): string | null {
  const entries = [
    ['claim', citation.claimId],
    ['binding', citation.claimBindingId],
    ['evidence', citation.claimEvidenceId],
    ['round', citation.fundingRoundId],
    ['participant', citation.roundParticipantId],
    ['thesis', citation.thesisRecordId],
    ['pattern', citation.patternId],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return entries.length ? entries.map(([kind, id]) => `${kind}:${id}`).join('|') : null;
}

export function evaluateAnswerDraft(draft: AnswerSnapshotDraft, allowedTargets: Set<string>): AnswerEvaluation {
  const completeness = citationCompleteness(draft);
  const targets = draft.sections.filter(section => section.material).flatMap(section => section.citations)
    .map(citationTarget).filter((target): target is string => Boolean(target));
  const unsupportedTargets = targets.filter(target =>
    !target.split('|').some(part => allowedTargets.has(part)),
  );
  const faithfulness = targets.length === 0 ? (completeness.materialSections === 0 ? 1 : 0) : (targets.length - unsupportedTargets.length) / targets.length;
  return {
    citationCompleteness: completeness.ratio,
    citationFaithfulness: faithfulness,
    citedTargets: targets.length,
    unsupportedTargets,
    passed: completeness.ratio === 1 && faithfulness === 1,
  };
}

export function validateDraft(draft: AnswerSnapshotDraft): void {
  const completeness = citationCompleteness(draft);
  if (completeness.ratio !== 1) {
    throw new Error(`UNCITED_MATERIAL_SECTIONS:${completeness.missingSectionKeys.join(',')}`);
  }
  for (const section of draft.sections) {
    if (section.citations.some(citation => !hasNormalizedTarget(citation))) {
      throw new Error(`UNNORMALIZED_CITATION:${section.key}`);
    }
  }
  if (draft.counts.disclosedRoundCount + draft.counts.undisclosedRoundCount > draft.counts.roundCount) {
    throw new Error('INVALID_DISCLOSURE_COUNTS');
  }
}

function validateNarration(draft: AnswerSnapshotDraft, narration: Record<string, string>): void {
  const allowed = new Set(draft.sections.map(section => section.key));
  for (const [key, value] of Object.entries(narration)) {
    if (!allowed.has(key) || typeof value !== 'string' || value.trim().length < 10 || value.length > 4000) {
      throw new Error(`MALFORMED_NARRATION:${key}`);
    }
  }
  for (const section of draft.sections.filter(section => section.material)) {
    if (!narration[section.key]) throw new Error(`MISSING_NARRATION:${section.key}`);
  }
}

export async function composeAnswer(
  deterministicDraft: AnswerSnapshotDraft,
  provider?: NarrationProvider,
): Promise<{ draft: AnswerSnapshotDraft; narrationMode: 'model' | 'deterministic_fallback'; narrationError?: string }> {
  validateDraft(deterministicDraft);
  if (!provider) return { draft: deterministicDraft, narrationMode: 'deterministic_fallback' };

  try {
    const narration = await provider.narrate(deterministicDraft);
    validateNarration(deterministicDraft, narration);
    return {
      draft: {
        ...deterministicDraft,
        sections: deterministicDraft.sections.map(section => ({
          ...section,
          narrative: narration[section.key] ?? section.narrative,
        })),
      },
      narrationMode: 'model',
    };
  } catch (error) {
    return {
      draft: deterministicDraft,
      narrationMode: 'deterministic_fallback',
      narrationError: error instanceof Error ? error.message : 'Unknown narration failure',
    };
  }
}

function overlap(values: unknown, preferences: string[]): string[] {
  if (!Array.isArray(values)) return [];
  const preferred = new Set(preferences.map(value => value.toLowerCase()));
  return values
    .map(value => typeof value === 'string' ? value.toLowerCase() : '')
    .filter(value => value && preferred.has(value));
}

export function rankSectionsForPreferences(
  sections: AnswerSection[],
  preferences: UserAnswerPreferences,
): AnswerSection[] {
  return sections
    .map(section => {
      const serialized = JSON.stringify(section.metrics).toLowerCase();
      const domainMatches = preferences.domains.filter(value => serialized.includes(value.toLowerCase()));
      const geographyMatches = preferences.geographies.filter(value => serialized.includes(value.toLowerCase()));
      const stageMatches = preferences.stages.filter(value => serialized.includes(value.toLowerCase()));
      const score = domainMatches.length * 3 + geographyMatches.length * 2 + stageMatches.length;
      return {
        ...section,
        whyThis: {
          score,
          domainMatches,
          geographyMatches,
          stageMatches,
          explicitPreferenceMatch: score > 0,
          // Kept for forward compatibility when metrics expose flat arrays.
          directMatches: overlap(section.metrics.tags, [...preferences.domains, ...preferences.geographies, ...preferences.stages]),
        },
      };
    })
    .sort((a, b) => Number(b.whyThis.score) - Number(a.whyThis.score) || a.position - b.position)
    .map((section, position) => ({ ...section, position }));
}

export function toPreview(draft: AnswerSnapshotDraft): AnswerSnapshotDraft {
  return {
    ...draft,
    sections: draft.sections.slice(0, 1).map(section => ({
      ...section,
      narrative: section.narrative.slice(0, 280),
      citations: section.citations.slice(0, 2),
      metrics: {
        roundCount: section.metrics.roundCount,
        disclosedRoundCount: section.metrics.disclosedRoundCount,
        undisclosedRoundCount: section.metrics.undisclosedRoundCount,
        recordCount: section.metrics.recordCount,
      },
    })),
    caveats: draft.caveats.slice(0, 2),
    counterEvidence: draft.counterEvidence.slice(0, 1),
  };
}
