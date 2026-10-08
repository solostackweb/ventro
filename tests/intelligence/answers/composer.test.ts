import { buildInvestingNowDraft } from '@/lib/intelligence/answers/aggregations';
import { citationCompleteness, composeAnswer, evaluateAnswerDraft, rankSectionsForPreferences, validateDraft } from '@/lib/intelligence/answers/composer';
import { bundle, filters } from './fixtures';

describe('answer composer', () => {
  it('measures complete citation coverage for every material section', () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    expect(citationCompleteness(draft)).toEqual(expect.objectContaining({ ratio: 1, missingSectionKeys: [] }));
  });

  it('rejects an uncited material section', () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    draft.sections[0].citations = [];
    expect(() => validateDraft(draft)).toThrow('UNCITED_MATERIAL_SECTIONS');
  });

  it('uses deterministic prose when no model is configured', async () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    const result = await composeAnswer(draft);
    expect(result.narrationMode).toBe('deterministic_fallback');
    expect(result.draft.sections[0].narrative).toBe(draft.sections[0].narrative);
  });

  it('falls back when a provider errors or returns malformed output', async () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    const throwing = await composeAnswer(draft, { name: 'test', model: 'test', narrate: async () => { throw new Error('provider down'); } });
    expect(throwing.narrationMode).toBe('deterministic_fallback');
    expect(throwing.narrationError).toMatch(/provider down/);
    const malformed = await composeAnswer(draft, { name: 'test', model: 'test', narrate: async () => ({ unknown: 'too short' }) });
    expect(malformed.narrationMode).toBe('deterministic_fallback');
  });

  it('accepts narration only for known, fully covered sections', async () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    const narration = Object.fromEntries(draft.sections.filter(section => section.material).map(section => [section.key, `Evidence-backed narration for ${section.key}.`]));
    const result = await composeAnswer(draft, { name: 'test', model: 'test', narrate: async () => narration });
    expect(result.narrationMode).toBe('model');
  });

  it('ranks shared snapshot sections and explains preference matches without copying snapshots', () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    const ranked = rankSectionsForPreferences(draft.sections, { domains: ['agents'], geographies: ['us'], stages: ['seed'] });
    expect(ranked).not.toBe(draft.sections);
    expect(ranked.some(section => 'explicitPreferenceMatch' in section.whyThis)).toBe(true);
  });

  it('passes the labelled fixture faithfulness evaluation and detects an unsupported target', () => {
    const draft = buildInvestingNowDraft(filters, bundle());
    const allowed = new Set<string>();
    for (const section of draft.sections) for (const citation of section.citations) {
      if (citation.claimId) allowed.add(`claim:${citation.claimId}`);
      if (citation.claimEvidenceId) allowed.add(`evidence:${citation.claimEvidenceId}`);
      if (citation.fundingRoundId) allowed.add(`round:${citation.fundingRoundId}`);
    }
    expect(evaluateAnswerDraft(draft, allowed)).toEqual(expect.objectContaining({ passed: true, citationCompleteness: 1, citationFaithfulness: 1 }));
    draft.sections[0].citations.push({ stance: 'supports', claimId: 'unsupported-claim' });
    expect(evaluateAnswerDraft(draft, allowed).passed).toBe(false);
  });
});
