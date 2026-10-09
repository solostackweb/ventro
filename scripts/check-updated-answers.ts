import { getBothLatestAnswers } from '../src/lib/intelligence/answers/service';
import { normalizeAnswerFilters } from '../src/lib/intelligence/answers/filters';

async function main() {
  const filters = normalizeAnswerFilters({
    periodStart: '2026-07-11T00:00:00.000Z',
    periodEnd: '2026-10-09T00:00:00.000Z',
    domains: [],
    geographies: ['india'],
    stages: [],
  });

  const answers = await getBothLatestAnswers(filters);
  console.log('investingNow:', answers.investingNow?.summary?.headline);
  console.log('marketDemand:', answers.marketDemand?.summary?.headline);
  console.log('investingNow sections:', answers.investingNow?.sections?.length);
  console.log('marketDemand sections:', answers.marketDemand?.sections?.length);
  
  if (answers.investingNow?.sections) {
    answers.investingNow.sections.forEach((s, i) => {
      console.log(`  Section ${i}: ${s.key} - ${s.title} - ${s.narrative.slice(0, 80)}...`);
    });
  }
}

main().catch(console.error);