import { ingestionSupabase } from '@/lib/supabase/ingestion';

interface PatternCandidate {
  name: string;
  description: string;
  time_window_start: string;
  time_window_end: string;
  baseline_value: number;
  current_value: number;
  change_percentage: number;
  distinct_companies: number;
  distinct_funds: number;
  qualifying_events: QualifyingEvent[];
  counterexamples: Counterexample[];
  confidence: 'high' | 'medium' | 'low';
  coverage_notes: string;
  status: 'candidate' | 'published' | 'corrected' | 'retired' | 'rejected';
  source_links: string[];
}

interface QualifyingEvent {
  date: string;
  company_id: string;
  company_name: string;
  round_stage: string | null;
  amount_usd: number | null;
  fund_ids: string[];
  fund_names: string[];
  source_url: string;
}

interface Counterexample {
  entity_id: string;
  entity_name: string;
  entity_type: 'company' | 'fund';
  reason: string;
}

interface RoundEvent {
  round_id: string;
  company_id: string;
  company_name: string;
  company_ai_tags: string[];
  company_country: string;
  yc_batch: string | null;
  announced_date: string;
  round_stage: string;
  amount_usd: number | null;
  amount_currency: string;
  fund_id: string;
  fund_name: string;
  firm_type: string;
  participant_role: string;
  participant_amount_usd: number | null;
  round_sources: string[];
}

function detectFundingSurge(
  events: RoundEvent[],
  theme?: string,
  windowMonths: number = 12
): PatternCandidate[] {
  const patterns: PatternCandidate[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMonths * 30 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date();

  // Filter events in window
  const windowEvents = events.filter(e => {
    const eventDate = new Date(e.announced_date);
    return eventDate >= windowStart && eventDate <= windowEnd;
  });

  if (windowEvents.length < 5) return patterns;

  // Group by theme
  const themeGroups: Record<string, RoundEvent[]> = {};
  for (const event of windowEvents) {
    const tags = event.company_ai_tags || [];
    for (const tag of tags) {
      if (!themeGroups[tag]) themeGroups[tag] = [];
      themeGroups[tag].push(event);
    }
  }

  for (const [theme, themeEvents] of Object.entries(themeGroups)) {
    if (themeEvents.length < 3) continue;

    // Calculate baseline from previous period
    const prevWindowStart = new Date(windowStart.getTime() - windowMonths * 30 * 24 * 60 * 60 * 1000);
    const prevEvents = events.filter(e => {
      const eventDate = new Date(e.announced_date);
      return eventDate >= prevWindowStart && eventDate < windowStart;
    });

    const prevThemeEvents = prevEvents.filter(e =>
      (e.company_ai_tags || []).includes(theme)
    );

    const baselineCount = prevThemeEvents.length;
    const currentCount = themeEvents.length;

    if (baselineCount === 0 && currentCount < 5) continue;
    if (baselineCount === 0) {
      // New theme emergence
      if (currentCount >= 5) {
        const companies = new Set(themeEvents.map(e => e.company_id));
        const funds = new Set(themeEvents.map(e => e.fund_id));

        // Find counterexamples (non-theme events that could be confused)
        const otherThemeEvents = windowEvents.filter(e =>
          !(e.company_ai_tags || []).includes(theme)
        );
        const counterexamples: Counterexample[] = otherThemeEvents.slice(0, 5).map(e => ({
          entity_id: e.company_id,
          entity_name: e.company_name,
          entity_type: 'company' as const,
          reason: `Non-${theme} company raised in same window`,
        }));

        patterns.push({
          name: `${theme.replace('_', ' ')} Surge`,
          description: `Unusual spike in ${theme.replace('_', ' ')} funding activity with ${currentCount} deals vs ${baselineCount} baseline`,
          time_window_start: windowStart.toISOString(),
          time_window_end: windowEnd.toISOString(),
          baseline_value: baselineCount,
          current_value: currentCount,
          change_percentage: baselineCount > 0 ? ((currentCount - baselineCount) / baselineCount) * 100 : 100,
          distinct_companies: companies.size,
          distinct_funds: funds.size,
          qualifying_events: themeEvents.map(e => ({
            date: e.announced_date,
            company_id: e.company_id,
            company_name: e.company_name,
            round_stage: e.round_stage,
            amount_usd: e.amount_usd,
            fund_ids: [e.fund_id],
            fund_names: [e.fund_name],
            source_url: e.round_sources[0] || '',
          })),
          counterexamples,
          confidence: currentCount >= 10 ? 'high' : currentCount >= 5 ? 'medium' : 'low',
          coverage_notes: `Based on ${themeEvents.length} disclosed rounds in ${windowMonths}-month window. Private deals not visible.`,
          status: 'candidate',
          source_links: themeEvents.flatMap(e => e.round_sources).slice(0, 10),
        });
      }
    } else {
      const changePct = ((currentCount - baselineCount) / baselineCount) * 100;

      if (changePct >= 50) { // 50% increase threshold
        const companies = new Set(themeEvents.map(e => e.company_id));
        const funds = new Set(themeEvents.map(e => e.fund_id));

        const otherThemeEvents = windowEvents.filter(e =>
          !(e.company_ai_tags || []).includes(theme)
        );
        const counterexamples: Counterexample[] = otherThemeEvents.slice(0, 5).map(e => ({
          entity_id: e.company_id,
          entity_name: e.company_name,
          entity_type: 'company' as const,
          reason: `Non-${theme} company raised in same window`,
        }));

        patterns.push({
          name: `${theme.replace('_', ' ')} Acceleration`,
          description: `${theme.replace('_', ' ')} funding accelerated ${changePct.toFixed(0)}% (${currentCount} deals vs ${baselineCount} baseline)`,
          time_window_start: windowStart.toISOString(),
          time_window_end: windowEnd.toISOString(),
          baseline_value: baselineCount,
          current_value: currentCount,
          change_percentage: changePct,
          distinct_companies: companies.size,
          distinct_funds: funds.size,
          qualifying_events: themeEvents.map(e => ({
            date: e.announced_date,
            company_id: e.company_id,
            company_name: e.company_name,
            round_stage: e.round_stage,
            amount_usd: e.amount_usd,
            fund_ids: [e.fund_id],
            fund_names: [e.fund_name],
            source_url: e.round_sources[0] || '',
          })),
          counterexamples,
          confidence: currentCount >= 10 ? 'high' : currentCount >= 5 ? 'medium' : 'low',
          coverage_notes: `Based on ${themeEvents.length} disclosed rounds in ${windowMonths}-month window. Private deals not visible.`,
          status: 'candidate',
          source_links: themeEvents.flatMap(e => e.round_sources).slice(0, 10),
        });
      }
    }
  }

  return patterns;
}

function detectInvestorConcentration(
  events: RoundEvent[],
  windowMonths: number = 12
): PatternCandidate[] {
  const patterns: PatternCandidate[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMonths * 30 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date();

  const windowEvents = events.filter(e => {
    const eventDate = new Date(e.announced_date);
    return eventDate >= windowStart && eventDate <= windowEnd;
  });

  if (windowEvents.length < 10) return patterns;

  // Count deals per fund
  const fundCounts: Record<string, { count: number; name: string; events: RoundEvent[] }> = {};
  for (const event of windowEvents) {
    if (!fundCounts[event.fund_id]) {
      fundCounts[event.fund_id] = { count: 0, name: event.fund_name, events: [] };
    }
    fundCounts[event.fund_id].count++;
    fundCounts[event.fund_id].events.push(event);
  }

  // Find top funds with unusual activity
  const sortedFunds = Object.entries(fundCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const totalDeals = windowEvents.length;
  const avgDeals = totalDeals / Object.keys(fundCounts).length;

  for (const [fundId, data] of sortedFunds) {
    if (data.count >= Math.max(5, avgDeals * 2)) {
      const baselineCount = 0; // Would need historical data
      const currentCount = data.count;

      patterns.push({
        name: `${data.name} Activity Spike`,
        description: `${data.name} participated in ${currentCount} deals (${(currentCount / totalDeals * 100).toFixed(1)}% of all deals)`,
        time_window_start: windowStart.toISOString(),
        time_window_end: windowEnd.toISOString(),
        baseline_value: Math.round(avgDeals),
        current_value: currentCount,
        change_percentage: ((currentCount - avgDeals) / avgDeals) * 100,
        distinct_companies: new Set(data.events.map(e => e.company_id)).size,
        distinct_funds: 1,
        qualifying_events: data.events.map(e => ({
          date: e.announced_date,
          company_id: e.company_id,
          company_name: e.company_name,
          round_stage: e.round_stage,
          amount_usd: e.amount_usd,
          fund_ids: [e.fund_id],
          fund_names: [e.fund_name],
          source_url: e.round_sources[0] || '',
        })),
        counterexamples: [],
        confidence: 'medium',
        coverage_notes: `Fund participated in ${currentCount}/${totalDeals} deals in window.`,
        status: 'candidate',
        source_links: data.events.flatMap(e => e.round_sources).slice(0, 10),
      });
    }
  }

  return patterns;
}

function detectStageShift(
  events: RoundEvent[],
  windowMonths: number = 12
): PatternCandidate[] {
  const patterns: PatternCandidate[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMonths * 30 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date();

  const windowEvents = events.filter(e => {
    const eventDate = new Date(e.announced_date);
    return eventDate >= windowStart && eventDate <= windowEnd;
  });

  // Group by stage
  const stageGroups: Record<string, RoundEvent[]> = {};
  for (const event of windowEvents) {
    const stage = event.round_stage || 'unknown';
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(event);
  }

  for (const [stage, stageEvents] of Object.entries(stageGroups)) {
    if (stageEvents.length < 5) continue;

    const companies = new Set(stageEvents.map(e => e.company_id));
    const funds = new Set(stageEvents.map(e => e.fund_id));

    // Compare to previous period
    const prevWindowStart = new Date(windowStart.getTime() - windowMonths * 30 * 24 * 60 * 60 * 1000);
    const prevEvents = events.filter(e => {
      const eventDate = new Date(e.announced_date);
      return eventDate >= prevWindowStart && eventDate < windowStart && e.round_stage === stage;
    });

    const baselineCount = prevEvents.length;
    const currentCount = stageEvents.length;

    if (baselineCount === 0) continue;

    const changePct = ((currentCount - baselineCount) / baselineCount) * 100;

    if (Math.abs(changePct) >= 50) {
      const direction = changePct > 0 ? 'Surge' : 'Decline';

      patterns.push({
        name: `${stage.replace('_', ' ')} ${direction}`,
        description: `${stage.replace('_', ' ')} deals ${direction.toLowerCase()} ${Math.abs(changePct).toFixed(0)}% (${currentCount} vs ${baselineCount})`,
        time_window_start: windowStart.toISOString(),
        time_window_end: windowEnd.toISOString(),
        baseline_value: baselineCount,
        current_value: currentCount,
        change_percentage: changePct,
        distinct_companies: companies.size,
        distinct_funds: funds.size,
        qualifying_events: stageEvents.map(e => ({
          date: e.announced_date,
          company_id: e.company_id,
          company_name: e.company_name,
          round_stage: e.round_stage,
          amount_usd: e.amount_usd,
          fund_ids: [e.fund_id],
          fund_names: [e.fund_name],
          source_url: e.round_sources[0] || '',
        })),
        counterexamples: [],
        confidence: 'medium',
        coverage_notes: `Stage-specific analysis of ${stageEvents.length} deals.`,
        status: 'candidate',
        source_links: stageEvents.flatMap(e => e.round_sources).slice(0, 10),
      });
    }
  }

  return patterns;
}

export async function detectPatterns(): Promise<void> {
  const supabase = ingestionSupabase;

  // Get verified rounds from investment_graph
  const { data: events, error } = await supabase
    .from('investment_graph')
    .select('*')
    .eq('round_verification', 'verified')
    .eq('participant_verification', 'verified')
    .order('announced_date', { ascending: false });

  if (error || !events?.length) {
    console.log('No verified events for pattern detection');
    return;
  }

  console.log(`Analyzing ${events.length} verified events for patterns...`);

  const allPatterns: PatternCandidate[] = [];

  // Run different pattern detectors
  allPatterns.push(...detectFundingSurge(events, undefined, 12));
  allPatterns.push(...detectInvestorConcentration(events, 12));
  allPatterns.push(...detectStageShift(events, 12));

  // Also check 6-month window
  allPatterns.push(...detectFundingSurge(events, undefined, 6));
  allPatterns.push(...detectStageShift(events, 6));

  console.log(`Detected ${allPatterns.length} pattern candidates`);

  // Upsert patterns
  for (const pattern of allPatterns) {
    const { error } = await supabase
      .from('patterns')
      .upsert({
        name: pattern.name,
        description: pattern.description,
        time_window_start: pattern.time_window_start,
        time_window_end: pattern.time_window_end,
        baseline_value: pattern.baseline_value,
        current_value: pattern.current_value,
        change_percentage: pattern.change_percentage,
        distinct_companies: pattern.distinct_companies,
        distinct_funds: pattern.distinct_funds,
        qualifying_events: pattern.qualifying_events,
        counterexamples: pattern.counterexamples,
        confidence: pattern.confidence,
        coverage_notes: pattern.coverage_notes,
        status: pattern.status,
        source_links: pattern.source_links,
      }, { onConflict: 'name,time_window_start,time_window_end' });

    if (error) {
      console.error(`Failed to upsert pattern ${pattern.name}:`, error.message);
    }
  }

  console.log(`Upserted ${allPatterns.length} patterns`);
}

export async function runPatternDetectionPipeline(): Promise<void> {
  console.log('Starting pattern detection pipeline...');
  await detectPatterns();
  console.log('Pattern detection pipeline completed');
}