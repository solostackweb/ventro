import { buildInvestingNowDraft } from '@/lib/intelligence/answers/aggregations';
import { citationCompleteness, composeAnswer, composeAnswerSet, evaluateAnswerDraft, rankSectionsForPreferences, validateDraft } from '@/lib/intelligence/answers/composer';
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

  it('turns both dashboard questions into conclusion-first editorial answers when NVIDIA is unavailable', async () => {
    const previous = process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    try {
      const investing = buildInvestingNowDraft(filters, bundle());
      const { buildMarketDemandDraft } = await import('@/lib/intelligence/answers/aggregations');
      const demand = buildMarketDemandDraft(filters, bundle());
      const results = await composeAnswerSet([investing, demand]);
      expect(results[0].draft.summary.headline).toMatch(/capital is concentrating|activity is broad/i);
      expect(results[0].draft.summary.headline).not.toMatch(/^\d+ verified rounds/i);
      expect(results[1].draft.summary.headline).toMatch(/explicitly emphasize|aligned around/i);
      expect(results.every(result => result.narrationMode === 'deterministic_fallback')).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = previous;
    }
  });

  it('uses one NVIDIA pass to synthesize both answers and their alignment without changing evidence', async () => {
    const previous = process.env.NVIDIA_API_KEY;
    process.env.NVIDIA_API_KEY = 'test-nvidia-key';
    const investing = buildInvestingNowDraft(filters, bundle());
    const { buildMarketDemandDraft } = await import('@/lib/intelligence/answers/aggregations');
    const demand = buildMarketDemandDraft(filters, bundle());
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: `${JSON.stringify({
        investing_now: {
          headline: 'Investor capital is concentrating in application-layer AI, with seed financings supplying the clearest verified momentum.',
          sections: Object.fromEntries(investing.sections.filter(section => section.material).map((section, index) => [section.key, index === 0
            ? { headline: section.title, content: `Editorial interpretation of ${section.title.toLowerCase()} grounded in its unchanged metrics and evidence.` }
            : `Editorial interpretation of ${section.title.toLowerCase()} grounded in its unchanged metrics and evidence.`])),
        },
        market_demand: {
          headline: 'Investors want agent infrastructure, while observed portfolios favor vertical agents; the signals align around applied agent adoption.',
          sections: Object.fromEntries(demand.sections.filter(section => section.material).map(section => [section.key, `Editorial interpretation of ${section.title.toLowerCase()} grounded in its unchanged metrics and evidence.`])),
        },
      })}\nAnalysis complete.` } }] }),
    })) as unknown as typeof fetch;
    try {
      const results = await composeAnswerSet([investing, demand], undefined, fetchMock);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = JSON.parse(String((fetchMock as jest.Mock).mock.calls[0][1]?.body));
      expect(request.chat_template_kwargs).toEqual({ enable_thinking: false });
      expect(results.every(result => result.narrationMode === 'model')).toBe(true);
      expect(results[1].draft.summary.headline).toMatch(/align around applied agent adoption/i);
      expect(results[0].draft.sections[0].narrative).toMatch(/editorial interpretation/i);
      expect(results[0].draft.sections[0].citations).toEqual(investing.sections[0].citations);
      expect(results[0].draft.summary.narrationProvider).toBe('nvidia');
    } finally {
      if (previous === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = previous;
    }
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
