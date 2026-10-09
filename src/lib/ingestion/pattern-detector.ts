/* eslint-disable @typescript-eslint/no-explicit-any */
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { fingerprint } from '@/lib/intelligence/answers/hash';

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
  round_id: string;
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
            round_id: e.round_id,
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
            round_id: e.round_id,
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
          round_id: e.round_id,
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
          round_id: e.round_id,
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

function ycBatchTimestamp(batch: { year?: number; season?: string; demo_day_date?: string | null }): number {
  if (batch.demo_day_date) return new Date(batch.demo_day_date).getTime();
  const month = batch.season === 'W' ? 2 : batch.season === 'P' ? 4 : batch.season === 'S' ? 7 : 10;
  return Date.UTC(batch.year ?? 1970, month, 15);
}

async function materializeYcPatterns(): Promise<number> {
  const supabase = ingestionSupabase;
  const { data: memberships, error } = await supabase.from('yc_batch_companies').select(`
    batch_id, company_id, is_ai_company,
    companies!inner(id, canonical_name, ai_tags),
    yc_batches!inner(id, batch_name, year, season, demo_day_date)
  `).eq('is_ai_company', true).limit(10000);
  if (error) throw new Error(`YC pattern input failed: ${error.message}`);
  const { data: claims, error: claimError } = await supabase.from('claims').select(`
    id, subject_id, value_json, publication_status,
    claim_evidence!claim_evidence_claim_id_fkey(id,stance,document_version_id)
  `).eq('subject_type', 'company').eq('claim_type', 'yc_batch').eq('predicate', 'yc_membership')
    .eq('publication_status', 'published').limit(20000);
  if (claimError) throw new Error(`YC pattern evidence failed: ${claimError.message}`);
  const claimByMembership = new Map<string, any>();
  for (const claim of claims ?? []) claimByMembership.set(`${claim.subject_id}:${claim.value_json?.batch_id ?? ''}`, claim);
  const rows = ((memberships ?? []) as any[]).flatMap(row => {
    const claim = claimByMembership.get(`${row.company_id}:${row.batch_id}`);
    return claim ? [{ ...row, claim }] : [];
  });
  const batches = [...new Map(rows.map(row => [row.batch_id, row.yc_batches])).entries()]
    .map(([id, batch]) => ({ id, ...(batch as any) }))
    .filter(batch => ycBatchTimestamp(batch) <= Date.now())
    .sort((a, b) => ycBatchTimestamp(b) - ycBatchTimestamp(a));
  const recentCutoff = Date.now() - 18 * 30 * 24 * 60 * 60 * 1000;
  const recentBatches = batches.filter(batch => ycBatchTimestamp(batch) >= recentCutoff).slice(0, 3);
  if (recentBatches.length < 2) return 0;
  const currentBatchIds = new Set(recentBatches.map(batch => batch.id));
  const currentRows = rows.filter(row => currentBatchIds.has(row.batch_id));
  const themes = [...new Set(currentRows.flatMap(row => row.companies?.ai_tags ?? []))];
  let written = 0;
  const activePatternIds = new Set<string>();
  for (const theme of themes) {
    const qualifying = currentRows.filter(row => (row.companies?.ai_tags ?? []).includes(theme));
    const companyIds = new Set(qualifying.map(row => row.company_id));
    if (companyIds.size < 5) continue;
    const currentShare = currentRows.length ? qualifying.length / currentRows.length : 0;
    if (currentShare < 0.1) continue;
    const citations = qualifying.flatMap(row => (row.claim.claim_evidence ?? [])
      .filter((evidence: any) => evidence.stance === 'supports')
      .map((evidence: any) => ({ claim_id: row.claim.id, claim_evidence_id: evidence.id, stance: 'supports' })));
    const uniqueCitations = [...new Map(citations.map(citation => [`${citation.claim_id}:${citation.claim_evidence_id}`, citation])).values()];
    if (uniqueCitations.length < 3) continue;
    const windowStart = new Date(Math.min(...recentBatches.map(ycBatchTimestamp))).toISOString();
    const windowEnd = new Date(Math.max(...recentBatches.map(ycBatchTimestamp)) + 24 * 60 * 60 * 1000).toISOString();
    const humanTheme = theme.replaceAll('_', ' ');
    const inputFingerprint = fingerprint({
      theme,
      currentBatches: recentBatches.map(batch => batch.id),
      companyIds: [...companyIds].sort(),
      methodology: 'official-yc-batch-theme-concentration-v1',
    });
    const { data: stored, error: storeError } = await supabase.from('patterns').upsert({
      name: `${humanTheme.replace(/\b\w/g, (char: string) => char.toUpperCase())} Concentration Across Recent YC Batches`,
      description: `${qualifying.length} of ${currentRows.length} AI companies (${(currentShare * 100).toFixed(1)}%) across ${recentBatches.map(batch => batch.id).join(', ')} are tagged ${humanTheme}.`,
      time_window_start: windowStart,
      time_window_end: windowEnd,
      baseline_value: null,
      current_value: qualifying.length,
      change_percentage: null,
      distinct_companies: companyIds.size,
      distinct_funds: 1,
      qualifying_events: qualifying.map(row => ({
        company_id: row.company_id,
        company_name: row.companies?.canonical_name,
        yc_batch: row.batch_id,
        ai_topic: theme,
        source_url: row.claim.value_json?.source_url,
      })),
      counterexamples: [],
      confidence: companyIds.size >= 20 ? 'high' : companyIds.size >= 10 ? 'medium' : 'low',
      coverage_notes: `Descriptive composition of AI-tagged companies across recent completed YC batches. This is not a claim about funding volume or historical acceleration. YC directory membership is official; tags are deterministic classifications of company descriptions.`,
      status: 'published',
      source_links: [...new Set(qualifying.map(row => row.claim.value_json?.source_url).filter(Boolean))].slice(0, 25),
      pattern_type: 'yc_batch_theme_concentration',
      filter_dimensions: { domains: [theme], yc_batches: recentBatches.map(batch => batch.id) },
      baseline_window_start: null,
      baseline_window_end: null,
      sample_size: qualifying.length,
      qualifying_claim_ids: uniqueCitations.map(citation => citation.claim_id),
      independent_source_count: 1,
      coverage_metrics: { recent_ai_companies: currentRows.length, current_theme_share: currentShare, included_batches: recentBatches.map(batch => batch.id) },
      sensitivity: { recent_batch_count: recentBatches.length, lookback_months: 18, minimum_companies: 5, minimum_current_share: 0.1 },
      methodology_version: 'official-yc-batch-theme-concentration-v1',
      input_fingerprint: inputFingerprint,
      publication_reason: 'Published automatically as a descriptive concentration from official YC directory membership with deterministic topic classification',
    }, { onConflict: 'input_fingerprint' }).select('id').single();
    if (storeError) throw new Error(`YC pattern write failed: ${storeError.message}`);
    activePatternIds.add(stored.id);
    const { error: deleteError } = await supabase.from('pattern_citations').delete().eq('pattern_id', stored.id);
    if (deleteError) throw new Error(`YC pattern citation reset failed: ${deleteError.message}`);
    const { error: citationError } = await supabase.from('pattern_citations').insert(uniqueCitations.map(citation => ({
      pattern_id: stored.id,
      claim_id: citation.claim_id,
      claim_evidence_id: citation.claim_evidence_id,
      stance: citation.stance,
    })));
    if (citationError) throw new Error(`YC pattern citations failed: ${citationError.message}`);
    written++;
  }
  const { data: previousPatterns, error: previousError } = await supabase.from('patterns').select('id')
    .in('methodology_version', ['official-yc-batch-theme-trends-v1', 'official-yc-batch-theme-concentration-v1'])
    .in('status', ['published', 'corrected']);
  if (previousError) throw new Error(`YC pattern history read failed: ${previousError.message}`);
  for (const previous of previousPatterns ?? []) {
    if (activePatternIds.has(previous.id)) continue;
    const { error: retireError } = await supabase.from('patterns').update({
      status: 'retired',
      publication_reason: 'Retired automatically because its comparison included a future YC batch or was superseded by the latest eligible batch window',
    }).eq('id', previous.id);
    if (retireError) throw new Error(`YC pattern retirement failed: ${retireError.message}`);
  }
  return written;
}

async function materializePortfolioPatterns(): Promise<number> {
  const supabase = ingestionSupabase;
  const { data: relationships, error } = await supabase.from('fund_portfolio').select(`
    id, fund_id, company_id, verification_status, source_url, last_verified_at, updated_at,
    companies!inner(id, canonical_name, ai_tags),
    funds!inner(id, canonical_name)
  `).in('verification_status', ['verified', 'partial']).limit(10000);
  if (error) throw new Error(`Portfolio pattern input failed: ${error.message}`);
  const { data: claims, error: claimError } = await supabase.from('claims').select(`
    id, subject_id, value_json, publication_status,
    claim_evidence!claim_evidence_claim_id_fkey(
      id, stance, document_version_id,
      document_versions!claim_evidence_document_version_id_fkey(
        source_documents!document_versions_source_document_id_fkey(
          domain, source_connectors!source_documents_source_id_fkey(independence_group)
        )
      )
    )
  `).eq('subject_type', 'fund').eq('claim_type', 'other').eq('predicate', 'portfolio_company')
    .eq('publication_status', 'published').limit(20000);
  if (claimError) throw new Error(`Portfolio pattern evidence failed: ${claimError.message}`);
  const claimByRelationship = new Map<string, any>();
  for (const claim of claims ?? []) {
    claimByRelationship.set(`${claim.subject_id}:${claim.value_json?.company_id ?? ''}`, claim);
  }
  const byTheme = new Map<string, any[]>();
  for (const relationship of (relationships ?? []) as any[]) {
    const claim = claimByRelationship.get(`${relationship.fund_id}:${relationship.company_id}`);
    if (!claim) continue;
    for (const theme of relationship.companies?.ai_tags ?? []) {
      byTheme.set(theme, [...(byTheme.get(theme) ?? []), { ...relationship, claim }]);
    }
  }
  let written = 0;
  for (const [theme, rows] of byTheme) {
    const companyIds = new Set(rows.map(row => row.company_id));
    const fundIds = new Set(rows.map(row => row.fund_id));
    if (rows.length < 3 || companyIds.size < 3 || fundIds.size < 2) continue;
    const citations = rows.flatMap(row => (row.claim.claim_evidence ?? [])
      .filter((evidence: any) => evidence.stance === 'supports')
      .map((evidence: any) => ({
        claim_id: row.claim.id,
        claim_evidence_id: evidence.id,
        stance: 'supports',
        independence_group: evidence.document_versions?.source_documents?.source_connectors?.independence_group
          ?? evidence.document_versions?.source_documents?.domain
          ?? evidence.document_version_id,
      })));
    const uniqueCitations = [...new Map(citations.map(citation => [`${citation.claim_id}:${citation.claim_evidence_id}`, citation])).values()];
    const independenceGroups = new Set(uniqueCitations.map(citation => citation.independence_group));
    const timestamps = rows.map(row => row.last_verified_at ?? row.updated_at).filter(Boolean).sort();
    const windowStart = timestamps[0] ?? new Date().toISOString();
    const windowEnd = new Date().toISOString();
    const relationshipIds = rows.map(row => row.id).sort();
    const inputFingerprint = fingerprint({ theme, relationshipIds, methodology: 'official-portfolio-concentration-v1' });
    const publishable = uniqueCitations.length >= 3 && independenceGroups.size >= 2;
    const humanTheme = theme.replaceAll('_', ' ');
    const { data: stored, error: storeError } = await supabase.from('patterns').upsert({
      name: `${humanTheme.replace(/\b\w/g, char => char.toUpperCase())} Portfolio Concentration`,
      description: `${fundIds.size} tracked investors list ${companyIds.size} ${humanTheme} companies across their official portfolio pages.`,
      time_window_start: windowStart,
      time_window_end: windowEnd,
      baseline_value: null,
      current_value: rows.length,
      change_percentage: null,
      distinct_companies: companyIds.size,
      distinct_funds: fundIds.size,
      qualifying_events: rows.map(row => ({
        relationship_id: row.id,
        company_id: row.company_id,
        company_name: row.companies?.canonical_name,
        fund_id: row.fund_id,
        fund_name: row.funds?.canonical_name,
        source_url: row.source_url,
        verification_status: row.verification_status,
      })),
      counterexamples: [],
      confidence: independenceGroups.size >= 5 && companyIds.size >= 10 ? 'high' : independenceGroups.size >= 2 ? 'medium' : 'low',
      coverage_notes: `Based on ${rows.length} source-linked portfolio relationships from ${fundIds.size} official investor sites. Portfolio presence does not imply investment date, round, check size, or current ownership.`,
      status: publishable ? 'published' : 'candidate',
      source_links: [...new Set(rows.map(row => row.source_url).filter(Boolean))].slice(0, 25),
      pattern_type: 'portfolio_concentration',
      filter_dimensions: { domains: [theme] },
      baseline_window_start: null,
      baseline_window_end: null,
      sample_size: rows.length,
      qualifying_claim_ids: uniqueCitations.map(citation => citation.claim_id),
      independent_source_count: independenceGroups.size,
      coverage_metrics: {
        evidenced_relationships: uniqueCitations.length,
        qualifying_relationships: rows.length,
        verified_relationships: rows.filter(row => row.verification_status === 'verified').length,
      },
      sensitivity: { minimum_relationships: 3, minimum_companies: 3, minimum_funds: 2, minimum_independent_sources: 2 },
      methodology_version: 'official-portfolio-concentration-v1',
      input_fingerprint: inputFingerprint,
      publication_reason: publishable
        ? 'Published automatically from source-linked official portfolio relationships with cross-fund independence'
        : 'Candidate only: portfolio evidence breadth or source independence threshold was not met',
    }, { onConflict: 'input_fingerprint' }).select('id').single();
    if (storeError) throw new Error(`Portfolio pattern write failed: ${storeError.message}`);
    const { error: deleteError } = await supabase.from('pattern_citations').delete().eq('pattern_id', stored.id);
    if (deleteError) throw new Error(`Portfolio pattern citation reset failed: ${deleteError.message}`);
    if (uniqueCitations.length) {
      const { error: citationError } = await supabase.from('pattern_citations').insert(uniqueCitations.map(citation => ({
        pattern_id: stored.id,
        claim_id: citation.claim_id,
        claim_evidence_id: citation.claim_evidence_id,
        stance: citation.stance,
      })));
      if (citationError) throw new Error(`Portfolio pattern citations failed: ${citationError.message}`);
    }
    written++;
  }
  return written;
}

export async function detectPatterns(): Promise<void> {
  const supabase = ingestionSupabase;

  const ycPatternCount = await materializeYcPatterns();
  const portfolioPatternCount = await materializePortfolioPatterns();

  // Get verified rounds from investment_graph
  const { data: events, error } = await supabase
    .from('investment_graph')
    .select('*')
    .eq('round_verification', 'verified')
    .eq('participant_verification', 'verified')
    .order('announced_date', { ascending: false });

  if (error) throw new Error(`Funding pattern input failed: ${error.message}`);
  if (!events?.length) {
    if (portfolioPatternCount + ycPatternCount === 0) throw new Error('PATTERN_INPUT_EMPTY: no evidence-backed funding, YC, or portfolio relationships are available');
    console.log(`No verified funding events; published ${ycPatternCount} YC and ${portfolioPatternCount} portfolio patterns instead`);
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

  // Persist deterministic pattern records, then attach only published claim evidence.
  for (const pattern of allPatterns) {
    const roundIds = [...new Set(pattern.qualifying_events.map(event => event.round_id))];
    const duration = new Date(pattern.time_window_end).getTime() - new Date(pattern.time_window_start).getTime();
    const baselineWindowStart = new Date(new Date(pattern.time_window_start).getTime() - duration).toISOString();
    const inputFingerprint = fingerprint({
      name: pattern.name,
      windowStart: pattern.time_window_start,
      windowEnd: pattern.time_window_end,
      roundIds: [...roundIds].sort(),
      methodology: 'deterministic-patterns-v1',
    });
    const { data: stored, error } = await supabase
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
        status: 'candidate',
        source_links: pattern.source_links,
        pattern_type: pattern.name.toLowerCase().includes('stage') ? 'stage_shift' : pattern.name.toLowerCase().includes('activity') ? 'investor_concentration' : 'funding_acceleration',
        filter_dimensions: {},
        baseline_window_start: baselineWindowStart,
        baseline_window_end: pattern.time_window_start,
        sample_size: roundIds.length,
        coverage_metrics: { evidenced_rounds: 0, qualifying_rounds: roundIds.length },
        sensitivity: { minimum_events: 5, minimum_change_percentage: 50 },
        methodology_version: 'deterministic-patterns-v1',
        input_fingerprint: inputFingerprint,
        publication_reason: 'Awaiting evidence eligibility evaluation',
      }, { onConflict: 'input_fingerprint' })
      .select('id')
      .single();

    if (error) {
      console.error(`Failed to upsert pattern ${pattern.name}:`, error.message);
      continue;
    }

    const { data: bindings, error: bindingError } = roundIds.length
      ? await supabase.from('claim_bindings').select(`
          claim_id,
          claims!inner(
            id, publication_status,
            claim_evidence!claim_evidence_claim_id_fkey(
              id, stance, document_version_id,
              document_versions!claim_evidence_document_version_id_fkey(
                source_documents!document_versions_source_document_id_fkey(
                  source_id, domain,
                  source_connectors!source_documents_source_id_fkey(independence_group)
                )
              )
            )
          )
        `).eq('record_type', 'funding_round').in('record_id', roundIds).eq('claims.publication_status', 'published').limit(5000)
      : { data: [], error: null };
    if (bindingError) {
      console.error(`Failed to load evidence for pattern ${pattern.name}:`, bindingError.message);
      continue;
    }
    const citations = (bindings ?? []).flatMap((binding: any) =>
      (binding.claims?.claim_evidence ?? [])
        .filter((evidence: any) => evidence.stance === 'supports')
        .map((evidence: any) => ({
          pattern_id: stored.id,
          claim_id: binding.claim_id,
          claim_evidence_id: evidence.id,
          stance: 'supports',
          independence_group: evidence.document_versions?.source_documents?.source_connectors?.independence_group
            ?? evidence.document_versions?.source_documents?.domain
            ?? evidence.document_version_id,
        })),
    );
    const uniqueCitations = [...new Map(citations.map((citation: any) => [`${citation.claim_id}:supports`, citation])).values()];
    const independenceGroups = new Set(uniqueCitations.map((citation: any) => citation.independence_group));
    const { error: deleteCitationError } = await supabase.from('pattern_citations').delete().eq('pattern_id', stored.id);
    if (deleteCitationError) throw new Error(`Failed to replace pattern citations: ${deleteCitationError.message}`);
    if (uniqueCitations.length) {
      const { error: citationError } = await supabase.from('pattern_citations').insert(uniqueCitations.map((citation: any) => ({
        pattern_id: citation.pattern_id,
        claim_id: citation.claim_id,
        claim_evidence_id: citation.claim_evidence_id,
        stance: citation.stance,
      })));
      if (citationError) throw new Error(`Failed to persist pattern citations: ${citationError.message}`);
    }
    const publishable = roundIds.length >= 5 && pattern.distinct_companies >= 3 && pattern.distinct_funds >= 2 && independenceGroups.size >= 2 && uniqueCitations.length >= 3;
    let previousPatternId: string | null = null;
    if (publishable) {
      const { data: previousPattern, error: previousPatternError } = await supabase.from('patterns').select('id')
        .eq('name', pattern.name).eq('status', 'published').neq('id', stored.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (previousPatternError) throw new Error(`Failed to load pattern history: ${previousPatternError.message}`);
      previousPatternId = previousPattern?.id ?? null;
    }
    const { error: publishError } = await supabase.from('patterns').update({
      status: publishable ? 'published' : 'candidate',
      qualifying_claim_ids: uniqueCitations.map((citation: any) => citation.claim_id),
      independent_source_count: independenceGroups.size,
      coverage_metrics: {
        evidenced_claims: uniqueCitations.length,
        qualifying_rounds: roundIds.length,
        evidence_per_round: roundIds.length ? uniqueCitations.length / roundIds.length : 0,
      },
      publication_reason: publishable
        ? 'Published automatically: deterministic sample, breadth, independence, and claim-evidence thresholds passed'
        : 'Candidate only: one or more deterministic evidence thresholds were not met',
    }).eq('id', stored.id);
    if (publishError) throw new Error(`Failed to finalize pattern ${pattern.name}: ${publishError.message}`);
    if (previousPatternId) {
      const { error: retireError } = await supabase.from('patterns').update({ status: 'retired' }).eq('id', previousPatternId);
      if (retireError) throw new Error(`Failed to retire superseded pattern ${pattern.name}: ${retireError.message}`);
    }
  }

  console.log(`Upserted ${allPatterns.length} patterns`);
}

export async function runPatternDetectionPipeline(): Promise<void> {
  console.log('Starting pattern detection pipeline...');
  await detectPatterns();
  console.log('Pattern detection pipeline completed');
}
