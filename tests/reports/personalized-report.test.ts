import { createReportDocx } from '../../src/lib/reports/docx';
import { reportRequestSchema } from '../../src/lib/reports/schema';
import fs from 'node:fs';
import path from 'node:path';

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

  test('builds a valid DOCX package with sources and edit guidance', async () => {
    const result = await createReportDocx({
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
        summary: 'Verified activity was concentrated in early-stage rounds.',
        bullets: ['Parallax raised a verified Series A round.'],
        sourceIndexes: [1],
      }],
      caveats: ['Undisclosed amounts are not counted as zero.'],
      sources: [{ label: 'Funding evidence', url: 'https://example.com/evidence', sourceType: 'funding' }],
    }, request);

    expect(result.fileName).toBe('ai-capital-signals-for-india.docx');
    expect(result.buffer.byteLength).toBeGreaterThan(8_000);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
  });

  test('keeps generated artifact lifecycle writes server-managed', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261009030000_personalized_report_write_hardening.sql'), 'utf8');
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/reports/route.ts'), 'utf8');
    expect(migration).toContain('REVOKE UPDATE, DELETE');
    expect(migration).toContain('GRANT SELECT, INSERT');
    expect(route).toContain("ingestionSupabase.from('personalized_reports').update");
  });
});
