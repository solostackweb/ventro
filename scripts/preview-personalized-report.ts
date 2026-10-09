import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createReportDocx } from '../src/lib/reports/docx';
import { reportRequestSchema } from '../src/lib/reports/schema';

async function main() {
  const output = resolve(process.argv[2] || 'tmp/personalized-report-preview.docx');
  const request = reportRequestSchema.parse({
    title: 'AI Capital Signals: Personalized Research Brief',
    requestedPages: 6,
    periodDays: 90,
    geographies: ['India', 'United States'],
    fundIds: [],
    ycBatchIds: ['W25', 'S24'],
    topics: ['developer_tools', 'foundation_models'],
    includedSections: ['executive_summary', 'capital_flow', 'investor_theses', 'yc_signals', 'market_patterns', 'implications', 'sources'],
    audience: 'Investment committee',
    purpose: 'Prioritize sectors and diligence questions for the next quarter',
  });
  const { buffer } = await createReportDocx({
    title: request.title,
    subtitle: '90-day personalized VC, YC, thesis, and pattern intelligence brief',
    generatedAt: '2026-10-09T12:00:00.000Z',
    periodStart: '2026-07-11T00:00:00.000Z',
    periodEnd: '2026-10-09T00:00:00.000Z',
    methodology: 'Ventro includes only evidence that meets its publication contracts. Official statements and observed behavior remain separately labelled. Undisclosed values are never counted as zero.',
    executiveSummary: 'Verified activity in this sample is concentrated in early-stage infrastructure and application companies, while investor statements continue to emphasize developer tools and foundation-model infrastructure. The evidence is useful as a directional research brief, but the sample is not yet broad enough to establish a market-wide trend.',
    sections: [
      { key: 'capital_flow', title: 'Capital flow and verified investments', summary: 'Three verified rounds matched the selected window and scope.', bullets: ['Parallax: Series A with Greylock.', 'Antioch: Series A with Greylock.', 'Etched: verified investment evidence associated with Sequoia Capital.', 'No qualifying round disclosed an amount; undisclosed rounds are not treated as zero.'], sourceIndexes: [1, 2] },
      { key: 'investor_theses', title: 'What investors say and what behavior suggests', summary: 'Official statements and observed behavior are kept separate so attribution remains clear.', bullets: ['Stated themes emphasize applications, developer tools, infrastructure, and foundation models.', 'Observed behavior is beginning to reinforce applications and foundation-model infrastructure, but the verified sample remains limited.'], sourceIndexes: [2, 3] },
      { key: 'yc_signals', title: 'Y Combinator signals', summary: 'Batch composition is a descriptive signal rather than a prediction of company quality.', bullets: ['Recent batches show continued representation of developer tooling and applied AI companies.', 'Compare the current composition with completed historical batches before inferring acceleration.'], sourceIndexes: [4] },
      { key: 'market_patterns', title: 'Market patterns', summary: 'Published patterns are retained only when their sample and evidence thresholds are satisfied.', bullets: ['Infrastructure remains visible across both investment evidence and official investor commentary.', 'The available window does not yet support a strong capital-volume comparison.'], sourceIndexes: [1, 2, 3] },
      { key: 'implications', title: 'Interpretation and next questions', summary: 'These are research prompts, not predictions or investment advice.', bullets: ['Test whether infrastructure activity persists in the next 90-day window.', 'Ask whether application-layer investments are converging on repeatable go-to-market patterns.', 'Read each cited primary source and add decision-specific judgment before circulation.'], sourceIndexes: [] },
    ],
    caveats: ['The verified funding sample is small.', 'Undisclosed amounts are counted as undisclosed, not as zero.', 'A target page count guides content density; exact pagination varies by DOCX renderer and edits.'],
    sources: [
      { label: 'Greylock portfolio evidence', url: 'https://greylock.com/', sourceType: 'funding' },
      { label: 'Sequoia Capital stated thesis', url: 'https://www.sequoiacap.com/', sourceType: 'thesis' },
      { label: 'Andreessen Horowitz stated thesis', url: 'https://a16z.com/', sourceType: 'thesis' },
      { label: 'Y Combinator company directory', url: 'https://www.ycombinator.com/companies', sourceType: 'yc' },
    ],
  }, request);
  await writeFile(output, buffer);
  process.stdout.write(`${output}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
