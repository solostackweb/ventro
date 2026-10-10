/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { createReportDocx } from '../../src/lib/reports/docx';
import { reportRequestSchema } from '../../src/lib/reports/schema';
import { synthesizeAndVerifyReport } from '../../src/lib/reports/synthesis';

jest.setTimeout(240_000);

const live = process.env.RUN_LIVE_REPORT_SMOKE === '1' ? test : test.skip;

live('generates a reader-facing, model-verified report from a synthetic evidence packet', async () => {
  const request = reportRequestSchema.parse({
    title: 'Ventro report v2 live smoke test',
    requestedPages: 3,
    periodDays: 365,
    geographies: [],
    fundIds: ['11111111-1111-4111-8111-111111111111'],
    ycBatchIds: [],
    topics: [],
    includedSections: ['executive_summary', 'investor_theses', 'selected_investors', 'market_patterns', 'sources'],
    audience: 'Investment committee',
    purpose: 'Understand how Sequoia Capital’s stated AI thesis compares with observed portfolio behavior.',
  });
  const baseline = {
    title: request.title,
    subtitle: '365-day personalized VC thesis intelligence brief',
    generatedAt: '2026-10-10T00:00:00.000Z',
    periodStart: '2025-10-10T00:00:00.000Z',
    periodEnd: '2026-10-10T00:00:00.000Z',
    methodology: 'Stated thesis and observed portfolio evidence are kept separate.',
    executiveSummary: 'Sequoia Capital’s observed AI portfolio evidence is more concentrated in applications than in foundation models.',
    sections: [{
      key: 'investor_theses',
      title: 'What Sequoia says versus what it does',
      summary: { text: 'The stated thesis spans the AI stack, while observed portfolio activity is led by applications.', sourceIds: ['evidence-1', 'evidence-2'] },
      findings: [
        { text: 'Sequoia Capital’s official AI thesis discusses foundation models, infrastructure, developer tools, and applications.', sourceIds: ['evidence-1'] },
        { text: 'Observed portfolio evidence places applications first with 24 companies, ahead of infrastructure with 15 and foundation models with 9.', sourceIds: ['evidence-2'] },
      ],
    }],
    caveats: ['Observed portfolio behavior is an inference, not an investor quote.'],
    sources: [
      { id: 'evidence-1', label: 'Sequoia Capital — official AI thesis', url: 'https://sequoiacap.com/article/ai-a-new-era/', sourceType: 'thesis' as const },
      { id: 'evidence-2', label: 'Sequoia Capital — portfolio evidence', url: 'https://sequoiacap.com/companies/', sourceType: 'fund' as const },
    ],
    verification: { status: 'deterministic' as const, verifier: 'deterministic-contracts', issues: [] },
  };
  const generated = await synthesizeAndVerifyReport(baseline, request);
  const artifact = await createReportDocx(generated.content, request);
  const outputDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'ventro-report-v2-live-smoke.docx');
  fs.writeFileSync(outputPath, artifact.buffer);
  const extracted = await mammoth.extractRawText({ buffer: artifact.buffer });
  expect(generated.provider).toMatch(/^nvidia/);
  expect(generated.model).toContain('nemotron');
  if (generated.content.verification.status !== 'verified') {
    expect(generated.content.verification.issues.join(' ')).toMatch(/OpenAI verification was unavailable/i);
  }
  expect(extracted.value).toMatch(/Sequoia/i);
  expect(extracted.value).not.toMatch(/\[\s*\d+(?:\s*,\s*\d+)+\s*\]/);
  expect(extracted.value).not.toMatch(/\bSample=|\bsourceIndexes\b|\bclaim[_ ]ids?\b/i);
  expect(generated.content.sources.length).toBeGreaterThan(0);
});
