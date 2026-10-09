import { buildPersonalizedReport } from '../src/lib/reports/service';
import { reportRequestSchema } from '../src/lib/reports/schema';
import { createReportDocx } from '../src/lib/reports/docx';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const request = reportRequestSchema.parse({
    title: 'AI Capital Signals - Comprehensive',
    requestedPages: 10,
    periodDays: 90,
    geographies: ['india', 'us'],
    fundIds: [],
    ycBatchIds: ['W25', 'W26', 'S26'],
    topics: ['applications', 'foundation_models', 'infrastructure', 'robotics', 'developer_tools'],
    includedSections: ['executive_summary', 'capital_flow', 'investor_theses', 'yc_signals', 'market_patterns', 'selected_investors', 'implications', 'sources'],
    audience: 'Investment committee',
    purpose: 'Comprehensive AI capital intelligence brief',
  });

  console.log('Building report from database...');
  const { content, provider, model } = await buildPersonalizedReport(request);
  console.log(`Report built with ${provider}/${model}`);
  console.log(`Executive Summary: ${content.executiveSummary.slice(0, 200)}...`);
  console.log(`Sections: ${content.sections.map(s => s.key).join(', ')}`);
  console.log(`Sources: ${content.sources.length}`);

  const { buffer } = await createReportDocx(content, request);
  
  await mkdir(resolve('tmp'), { recursive: true });
  await writeFile(resolve('tmp/comprehensive-report.docx'), buffer);
  console.log('Report written to tmp/comprehensive-report.docx');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});