import { createReportDocx } from '../../src/lib/reports/docx';
import { reportRequestSchema } from '../../src/lib/reports/schema';
import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { assertReportQuality, synthesizeAndVerifyReport } from '../../src/lib/reports/synthesis';
import { thesisReadThrough } from '../../src/lib/reports/service';

const request = reportRequestSchema.parse({
  title: 'AI Capital Signals for India',
  requestedPages: 6,
  periodDays: 90,
  geographies: ['India'],
  fundIds: [],
  ycBatchIds: ['W25'],
  topics: ['developer_tools'],
  includedSections: ['executive_summary', 'capital_flow', 'investor_theses', 'sources'],
  audience: 'Investment committee',
  purpose: 'Prioritize diligence themes',
});

describe('personalized report contracts', () => {
  test('validates bounded personalization inputs', () => {
    expect(request.requestedPages).toBe(6);
    expect(() => reportRequestSchema.parse({ ...request, requestedPages: 30 })).toThrow();
    expect(() => reportRequestSchema.parse({ ...request, includedSections: ['sources'] })).toThrow();
  });

  test('builds a valid DOCX with named evidence instead of internal citation indexes', async () => {
    const content = {
      title: request.title,
      subtitle: '90-day personalized intelligence brief',
      generatedAt: '2026-10-09T00:00:00.000Z',
      periodStart: '2026-07-11T00:00:00.000Z',
      periodEnd: '2026-10-09T00:00:00.000Z',
      methodology: 'Only published evidence is included.',
      executiveSummary: 'Three verified rounds matched this scope.',
      sections: [{
        key: 'capital_flow',
        title: 'Capital flow',
        summary: { text: 'Verified activity was concentrated in early-stage rounds.', sourceIds: ['evidence-1'] },
        findings: [{ text: 'Parallax raised a verified Series A round.', sourceIds: ['evidence-1'] }],
      }],
      caveats: ['Undisclosed amounts are not counted as zero.'],
      sources: [{ id: 'evidence-1', label: 'Example News — funding evidence', url: 'https://example.com/evidence', sourceType: 'funding' as const }],
      verification: { status: 'verified' as const, verifier: 'openai:gpt-5-mini', issues: [] },
    };
    const result = await createReportDocx(content, request);
    const extracted = await mammoth.extractRawText({ buffer: result.buffer });

    expect(result.fileName).toMatch(/^personalized-intelligence-report-\d+\.docx$/);
    expect(result.buffer.byteLength).toBeGreaterThan(8_000);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(extracted.value).toContain('Example News — funding evidence');
    expect(extracted.value).not.toMatch(/\[\s*\d+(?:\s*,\s*\d+)+\s*\]/);
    expect(extracted.value).not.toContain('evidence-1');
    expect(() => assertReportQuality(content)).not.toThrow();
  });

  test('rejects database-shaped prose and unknown evidence references', () => {
    const invalid = {
      title: request.title,
      subtitle: '90-day personalized intelligence brief',
      generatedAt: '2026-10-09T00:00:00.000Z',
      periodStart: '2026-07-11T00:00:00.000Z',
      periodEnd: '2026-10-09T00:00:00.000Z',
      methodology: 'Only published evidence is included.',
      executiveSummary: 'This summary is long enough to pass the basic report output contract for testing.',
      sections: [{ key: 'patterns', title: 'Patterns', summary: { text: 'Sample=40 cos [42, 43, 144] is not reader-facing prose.', sourceIds: ['missing'] }, findings: [{ text: 'A sufficiently long finding for this invalid fixture.', sourceIds: [] }] }],
      caveats: [],
      sources: [],
      verification: { status: 'deterministic' as const, verifier: 'test', issues: [] },
    };
    expect(() => assertReportQuality(invalid)).toThrow('REPORT_QUALITY_INTERNAL_REFERENCE');
  });

  test('uses Nemotron for analysis and OpenAI for final evidence verification', async () => {
    const previousNvidia = process.env.NVIDIA_API_KEY;
    const previousOpenAI = process.env.OPENAI_API_KEY;
    process.env.NVIDIA_API_KEY = 'test-nvidia';
    process.env.OPENAI_API_KEY = 'test-openai';
    const baseline = {
      title: request.title,
      subtitle: '90-day personalized intelligence brief',
      generatedAt: '2026-10-09T00:00:00.000Z',
      periodStart: '2026-07-11T00:00:00.000Z',
      periodEnd: '2026-10-09T00:00:00.000Z',
      methodology: 'Only published evidence is included.',
      executiveSummary: 'The supplied evidence shows a clear application-layer emphasis in the selected investor portfolio.',
      sections: [{
        key: 'investor_theses',
        title: 'What the investor says versus what it does',
        summary: { text: 'Stated and observed theses are assessed separately.', sourceIds: ['evidence-1'] },
        findings: [{ text: 'Sequoia Capital’s observed AI activity leans toward applications ahead of foundation models.', sourceIds: ['evidence-1'] }],
      }],
      caveats: ['Observed thesis is an inference, not an investor quote.'],
      sources: [{ id: 'evidence-1', label: 'Sequoia Capital — portfolio evidence', url: 'https://sequoiacap.com/companies/', sourceType: 'fund' as const }],
      verification: { status: 'deterministic' as const, verifier: 'deterministic-contracts', issues: [] },
    };
    const reportPayload = {
      executiveSummary: baseline.executiveSummary,
      sections: baseline.sections,
    };
    const verifierPayload = { verdict: 'pass', issues: [], ...reportPayload };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reportPayload) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(verifierPayload) }), { status: 200 }));
    try {
      const result = await synthesizeAndVerifyReport(baseline, request, fetchMock as typeof fetch);
      expect(result.provider).toBe('nvidia+openai_verified');
      expect(result.content.verification.status).toBe('verified');
      expect(result.content.sections[0].findings[0].text).toContain('applications ahead of foundation models');
      expect(fetchMock.mock.calls[0][0]).toContain('nvidia.com');
      expect(fetchMock.mock.calls[1][0]).toContain('openai.com');
    } finally {
      if (previousNvidia === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = previousNvidia;
      if (previousOpenAI === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAI;
    }
  });

  test('turns observed investor theme counts into a direct comparative conclusion', () => {
    const conclusion = thesisReadThrough({
      fundName: 'Sequoia Capital',
      kind: 'observed',
      themes: [
        { theme: 'applications', companyCount: 24 },
        { theme: 'infrastructure', companyCount: 15 },
        { theme: 'foundation_models', companyCount: 9 },
      ],
    });
    expect(conclusion).toBe('Sequoia Capital’s observed AI activity leans most toward Applications (24 portfolio companies), ahead of Infrastructure (15 portfolio companies) and Foundation Models (9 portfolio companies).');
  });

  test('keeps generated artifact lifecycle writes server-managed', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261009030000_personalized_report_write_hardening.sql'), 'utf8');
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/reports/route.ts'), 'utf8');
    expect(migration).toContain('REVOKE UPDATE, DELETE');
    expect(migration).toContain('GRANT SELECT, INSERT');
    expect(route).toContain("ingestionSupabase.from('personalized_reports').update");
  });
});
