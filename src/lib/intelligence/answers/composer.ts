import type {
  AnswerKind,
  AnswerCitation,
  AnswerSection,
  AnswerSnapshotDraft,
  NarrationProvider,
  UserAnswerPreferences,
} from './types';

type AnswerNarration = {
  headline: string;
  sections: Record<string, string>;
};

type AnswerNarrationSet = Record<AnswerKind, AnswerNarration>;
type FetchLike = typeof fetch;

const NVIDIA_ANSWER_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

function rankedMetric(draft: AnswerSnapshotDraft, sectionKey: string, metricKey: string): Array<{ key: string; count: number }> {
  const section = draft.sections.find(candidate => candidate.key === sectionKey);
  const value = section?.metrics[metricKey];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { key: string; count: number } => Boolean(
    item && typeof item === 'object' && 'key' in item && 'count' in item,
  ));
}

function readable(value: string): string {
  return value.replaceAll('_', ' ');
}

function joinNatural(values: string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function editorialHeadline(draft: AnswerSnapshotDraft): string {
  if (draft.kind === 'investing_now') {
    if (draft.counts.roundCount === 0) return 'There is not enough verified investment activity to identify where investor capital is concentrating in this research slice.';
    const domains = rankedMetric(draft, 'leading_segments', 'domains').slice(0, 3).map(item => readable(item.key));
    const stages = rankedMetric(draft, 'leading_segments', 'stages').slice(0, 2).map(item => readable(item.key));
    if (domains.length) return `Investor capital is concentrating most in ${joinNatural(domains)}${stages.length ? `, led by ${joinNatural(stages)} financings` : ''}.`;
    return `Verified investor activity is broad rather than concentrated in one tracked AI segment${stages.length ? `, with ${joinNatural(stages)} financings most visible` : ''}.`;
  }

  const stated = rankedMetric(draft, 'stated_demand', 'themes').slice(0, 4).map(item => readable(item.key));
  const observed = rankedMetric(draft, 'observed_demand', 'themes').slice(0, 4).map(item => readable(item.key));
  if (!stated.length && !observed.length) return 'There is not enough verified thesis and portfolio evidence to identify what investors want from the market.';
  const observedSet = new Set(observed);
  const aligned = stated.filter(theme => observedSet.has(theme));
  if (aligned.length) return `Investors are most aligned around ${joinNatural(aligned.slice(0, 3))}: these themes lead both official theses and observed portfolio behavior.`;
  if (stated.length && observed.length) return `Investors explicitly emphasize ${joinNatural(stated.slice(0, 3))}, while their observed portfolios lean toward ${joinNatural(observed.slice(0, 3))}; the signals are related but not yet fully aligned.`;
  if (stated.length) return `Investors explicitly emphasize ${joinNatural(stated.slice(0, 3))}, but verified portfolio history is not yet deep enough to confirm behavioral alignment.`;
  return `Observed investor behavior leans toward ${joinNatural(observed.slice(0, 3))}, without enough official thesis evidence to confirm that this is an explicit market priority.`;
}

function editorializeDraft(draft: AnswerSnapshotDraft): AnswerSnapshotDraft {
  return { ...draft, summary: { ...draft.summary, headline: editorialHeadline(draft), narrationProvider: 'deterministic', narrationModel: null } };
}

function modelPacket(draft: AnswerSnapshotDraft) {
  return {
    question: draft.kind === 'investing_now' ? 'What are investors investing in now?' : 'What are investors looking for from the market?',
    filters: draft.filters,
    counts: draft.counts,
    confidence: draft.confidence,
    coverage: draft.coverage,
    caveats: draft.caveats,
    counterEvidence: draft.counterEvidence,
    sections: draft.sections.map(section => ({
      key: section.key,
      title: section.title,
      material: section.material,
      deterministicNarrative: section.narrative,
      metrics: section.metrics,
      evidenceLabels: [...new Set(section.citations.map(citation => citation.label).filter(Boolean))],
    })),
  };
}

function parseJsonObject(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('NVIDIA_ANSWER_JSON_MISSING');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index++) {
    const character = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(cleaned.slice(start, index + 1));
    }
  }
  throw new Error('NVIDIA_ANSWER_JSON_INCOMPLETE');
}

function validateNarrationSet(drafts: AnswerSnapshotDraft[], value: unknown): AnswerNarrationSet {
  if (!value || typeof value !== 'object') throw new Error('NVIDIA_ANSWER_INVALID');
  const result = {} as AnswerNarrationSet;
  for (const draft of drafts) {
    const candidate = (value as Record<string, unknown>)[draft.kind];
    if (!candidate || typeof candidate !== 'object') throw new Error(`NVIDIA_ANSWER_MISSING:${draft.kind}`);
    const headline = (candidate as Record<string, unknown>).headline;
    const sections = (candidate as Record<string, unknown>).sections;
    if (typeof headline !== 'string' || headline.trim().length < 15 || headline.length > 500) throw new Error(`NVIDIA_HEADLINE_INVALID:${draft.kind}`);
    if (/^\s*(?:across\s+\d+|\d+\s+(?:verified|published|observed)|\$[\d,.]+\s*)/i.test(headline) || /\b(?:were identified|records qualify)\b/i.test(headline)) throw new Error(`NVIDIA_HEADLINE_COUNT_FIRST:${draft.kind}`);
    if (!sections || typeof sections !== 'object' || Array.isArray(sections)) throw new Error(`NVIDIA_SECTIONS_INVALID:${draft.kind}`);
    const allowed = new Set(draft.sections.map(section => section.key));
    const normalizedSections: Record<string, string> = {};
    for (const [key, sectionValue] of Object.entries(sections as Record<string, unknown>)) {
      if (!allowed.has(key)) throw new Error(`NVIDIA_SECTION_UNKNOWN:${draft.kind}:${key}`);
      const narrative = typeof sectionValue === 'string'
        ? sectionValue
        : sectionValue && typeof sectionValue === 'object'
          ? [
            (sectionValue as Record<string, unknown>).content,
            (sectionValue as Record<string, unknown>).narrative,
            (sectionValue as Record<string, unknown>).headline,
          ].find(candidate => typeof candidate === 'string')
          : undefined;
      if (typeof narrative !== 'string' || narrative.trim().length < 10 || narrative.length > 1200) throw new Error(`NVIDIA_SECTION_INVALID:${draft.kind}:${key}`);
      normalizedSections[key] = narrative.trim();
    }
    result[draft.kind] = { headline: headline.trim(), sections: normalizedSections };
  }
  return result;
}

async function narrateAnswerSetWithNvidia(drafts: AnswerSnapshotDraft[], fetchImpl: FetchLike): Promise<{ narration: AnswerNarrationSet; model: string }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_NOT_CONFIGURED');
  const model = process.env.NVIDIA_DASHBOARD_MODEL || process.env.NVIDIA_REPORT_MODEL || NVIDIA_ANSWER_MODEL;
  const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: 1600,
      chat_template_kwargs: { enable_thinking: false },
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are Ventro\'s evidence-bound AI capital editor.',
            'Write the direct answer a founder or investor needs, not a database inventory.',
            'For investing_now, lead with the AI segments, stages, or markets attracting capital. Counts may support the conclusion but must not lead it.',
            'For market_demand, explain what investors want and explicitly state where official theses and observed portfolio behavior align or diverge.',
            'Compare the two questions when useful: what investors say they want versus where verified capital is actually moving.',
            'Never invent a theme, company, investor, number, cause, forecast, or source. Preserve stated versus observed as separate evidence classes.',
            'Do not use phrases such as "were identified", "records qualify", or "across N theses" in a headline.',
            'Return JSON only. Exact shape: {"investing_now":{"headline":"...","sections":{"section_key":"..."}},"market_demand":{"headline":"...","sections":{"section_key":"..."}}}.',
          ].join(' '),
        },
        { role: 'user', content: JSON.stringify(drafts.map(modelPacket)) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`NVIDIA_ANSWER_RESPONSE_${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('NVIDIA_ANSWER_EMPTY');
  return { narration: validateNarrationSet(drafts, parseJsonObject(content)), model };
}

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

export async function composeAnswerSet(
  deterministicDrafts: AnswerSnapshotDraft[],
  provider?: NarrationProvider,
  fetchImpl: FetchLike = fetch,
): Promise<Array<{ draft: AnswerSnapshotDraft; narrationMode: 'model' | 'deterministic_fallback'; narrationError?: string }>> {
  deterministicDrafts.forEach(validateDraft);
  if (provider) return Promise.all(deterministicDrafts.map(draft => composeAnswer(draft, provider)));

  const fallbacks = deterministicDrafts.map(editorializeDraft);
  try {
    const { narration, model } = await narrateAnswerSetWithNvidia(fallbacks, fetchImpl);
    return fallbacks.map(draft => ({
      draft: {
        ...draft,
        summary: { ...draft.summary, headline: narration[draft.kind].headline, narrationProvider: 'nvidia', narrationModel: model },
        sections: draft.sections.map(section => ({ ...section, narrative: narration[draft.kind].sections[section.key] ?? section.narrative })),
      },
      narrationMode: 'model' as const,
    }));
  } catch (error) {
    const narrationError = error instanceof Error ? error.message : 'Unknown NVIDIA narration failure';
    return fallbacks.map(draft => ({ draft, narrationMode: 'deterministic_fallback' as const, narrationError }));
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
