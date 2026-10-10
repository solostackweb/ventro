import { buildPersonalizedReport } from '../src/lib/reports/service';
import { reportRequestSchema } from '../src/lib/reports/schema';
import { createReportDocx } from '../src/lib/reports/docx';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const request = reportRequestSchema.parse({
    title: 'AI Ecosystem Research: YC, Global vs India, 3-Year Direction',
    requestedPages: 5,
    periodDays: 90,
    geographies: ['india', 'us'],
    fundIds: [],
    ycBatchIds: ['W23', 'W24', 'W25', 'S23', 'S24'],
    topics: ['applications', 'foundation_models', 'infrastructure', 'robotics', 'developer_tools'],
    includedSections: [
      'executive_summary',
      'capital_flow',
      'investor_theses',
      'yc_leadership',
      'yc_startups',
      'global_vs_india',
      'personal_direction',
      'yc_signals',
      'market_patterns',
      'selected_investors',
      'implications',
      'sources',
    ],
    audience: 'Founder/Operator building AI venture',
    purpose: 'Ecosystem research for 3-5 year career alignment',
    personalization: {
      includeEvidenceTrail: true,
      includeInvestmentTables: true,
      includeThesisComparison: true,
      includePatternAnalysis: true,
      includeInvestorProfiles: true,
      includeYCAnalysis: true,
      depthLevel: 'partner',
    },
  });

  console.log('Building comprehensive ecosystem report...');
  const { content, provider, model } = await buildPersonalizedReport(request);
  console.log(`Report built with ${provider}/${model}`);
  console.log(`Sections: ${content.sections.map(s => s.key).join(', ')}`);
  console.log(`Sources: ${content.sources.length}`);

  const { buffer } = await createReportDocx(content, request);
  
  await mkdir(resolve('tmp'), { recursive: true });
  await writeFile(resolve('tmp/ecosystem-report.docx'), buffer);
  console.log('Report written to tmp/ecosystem-report.docx');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});