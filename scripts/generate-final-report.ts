import { createReportDocx } from '../src/lib/reports/docx';
import { reportRequestSchema } from '../src/lib/reports/schema';
import { buildPersonalizedReport } from '../src/lib/reports/service';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const request = reportRequestSchema.parse({
    title: 'AI Capital Intelligence Brief - Comprehensive',
    requestedPages: 12,
    periodDays: 90,
    geographies: ['india', 'us'],
    fundIds: [],
    ycBatchIds: ['W25', 'W26', 'S26'],
    topics: ['applications', 'foundation_models', 'infrastructure', 'robotics', 'developer_tools', 'hardware'],
    includedSections: [
      'executive_summary', 
      'capital_flow', 
      'investor_theses', 
      'yc_signals', 
      'market_patterns', 
      'selected_investors', 
      'implications', 
      'sources',
      'evidence_trail',
      'investment_detail',
      'thesis_detail',
      'pattern_detail'
    ],
    audience: 'Investment Committee & Partners',
    purpose: 'Comprehensive AI capital intelligence for Q4 2026 allocation decisions',
  });

  console.log('Building comprehensive report from database...');
  const { content, provider, model } = await buildPersonalizedReport(request);
  console.log(`Report built with ${provider}/${model}`);
  console.log(`Sections: ${content.sections.map(s => s.key).join(', ')}`);
  console.log(`Sources: ${content.sources.length}`);

  const { buffer } = await createReportDocx(content, request);
  
  await mkdir(resolve('tmp'), { recursive: true });
  await writeFile(resolve('tmp/comprehensive-report-final.docx'), buffer);
  console.log('Report written to tmp/comprehensive-report-final.docx');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});