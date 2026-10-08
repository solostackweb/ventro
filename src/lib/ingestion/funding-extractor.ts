/**
 * Funding Evidence Extraction — Checkpoint 1
 * Extracts funding claims from immutable document versions, creates claims with evidence spans,
 * runs publication evaluation, and binds published claims to funding_round/round_participant fields.
 * Does NOT fetch live URLs — uses only stored document_versions.normalized_text.
 */

import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { evidenceCore, type EvidenceSpan } from '@/lib/intelligence/evidence/with-repository';
import crypto from 'crypto';

const STAGE_MAP: Record<string, string> = {
  'pre-seed': 'pre_seed',
  'pre_seed': 'pre_seed',
  'seed': 'seed',
  'series a': 'series_a',
  'series-a': 'series_a',
  'series b': 'series_b',
  'series-b': 'series_b',
  'series c': 'series_c',
  'series-c': 'series_c',
  'series d': 'series_d',
  'series-d': 'series_d',
  'series e': 'series_e',
  'series-e': 'series_e',
  'growth': 'growth',
  'late stage': 'growth',
  'late-stage': 'growth',
  'ipo': 'public',
  'public': 'public',
  'acquisition': 'acquisition',
  'grant': 'grant',
  'debt': 'debt',
  'convertible': 'convertible',
  'safe': 'safe',
};

const IMPLEMENTATION_VERSION = 'funding-extractor@1.0.0';

function normalizeStage(stage: string): string {
  const normalized = stage.toLowerCase().trim();
  return STAGE_MAP[normalized] || 'other';
}

function parseAmount(text: string): { amount: number; currency: string } | null {
  const patterns = [
    /\$(\d+(?:\.\d+)?)\s*(?:million|M|m)\b/i,
    /\$(\d+(?:\.\d+)?)\s*(?:billion|B|b)\b/i,
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/,
    /(\d+(?:\.\d+)?)\s*(?:million|M|m)\s*(?:USD|dollars?)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:billion|B|b)\s*(?:USD|dollars?)\b/i,
    /USD\s*(\d+(?:\.\d+)?)\s*(?:million|M|m)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:million|billion)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const isMillion = pattern.source.includes('million|M|m');
      const isBillion = pattern.source.includes('billion|B|b');
      if (isMillion || isBillion) {
        if (isBillion) {
          value *= 1_000_000_000;
        } else {
          value *= 1_000_000;
        }
      }
      return { amount: Math.round(value), currency: 'USD' };
    }
  }
  return null;
}

function mostFrequent<T extends string | number>(values: T[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function relatedName(relation: { canonical_name: string } | { canonical_name: string }[] | null | undefined): string | undefined {
  return Array.isArray(relation) ? relation[0]?.canonical_name : relation?.canonical_name;
}

interface DocumentSpan {
  documentVersionId: string;
  spans: EvidenceSpan[];
}

function findSpansInText(
  normalizedText: string,
  searchTerms: string[],
  extractorConfidence: number = 0.9
): EvidenceSpan[] {
  const spans: EvidenceSpan[] = [];
  
  for (const term of searchTerms) {
    const index = normalizedText.toLowerCase().indexOf(term.toLowerCase());
    if (index !== -1) {
      const excerpt = normalizedText.slice(index, index + term.length);
      spans.push({
        start: index,
        end: index + term.length,
        excerpt,
        checksum: evidenceCore.computeContentHash(excerpt),
      });
    }
  }
  
  return spans;
}

async function getConnectorInfo(sourceId: string) {
  const { data } = await ingestionSupabase
    .from('source_connectors')
    .select('source_id, trust_tier, is_official, independence_group, domain')
    .eq('source_id', sourceId)
    .single();
  return data;
}

interface FundingEvent {
  company_name: string;
  company_id: string | null;
  announced_date: string;
  round_stage: string;
  amount_usd?: number;
  amount_currency: string;
  lead_investors: string[];
  participant_investors: string[];
  source_urls: string[];
  document_versions: Array<{ id: string; normalized_text: string }>;
  verification_status: 'verified' | 'partial' | 'unverified' | 'conflicted';
  conflicts: RoundConflict[];
}

interface RoundConflict {
  field: string;
  source_a: string;
  source_b: string;
  values: unknown;
}

function detectConflicts(events: FundingEvent[]): RoundConflict[] {
  const conflicts: RoundConflict[] = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      if (a.company_name.toLowerCase() === b.company_name.toLowerCase() &&
          a.announced_date === b.announced_date &&
          a.round_stage === b.round_stage) {

        if (a.amount_usd !== b.amount_usd && a.amount_usd && b.amount_usd) {
          conflicts.push({
            field: 'amount_usd',
            source_a: a.source_urls[0],
            source_b: b.source_urls[0],
            values: [a.amount_usd, b.amount_usd],
          });
        }

        const allInvestorsA = [...a.lead_investors, ...a.participant_investors];
        const allInvestorsB = [...b.lead_investors, ...b.participant_investors];
        const setA = new Set(allInvestorsA.map(x => x.toLowerCase()));
        const setB = new Set(allInvestorsB.map(x => x.toLowerCase()));

        const diffA = [...setA].filter(x => !setB.has(x));
        const diffB = [...setB].filter(x => !setA.has(x));

        if (diffA.length > 0 || diffB.length > 0) {
          conflicts.push({
            field: 'investors',
            source_a: a.source_urls[0],
            source_b: b.source_urls[0],
            values: { only_in_a: diffA, only_in_b: diffB },
          });
        }
      }
    }
  }

  return conflicts;
}

export async function extractFundingEvidence(): Promise<void> {
  const supabase = ingestionSupabase;

  // Fetch known funds for matching
  const { data: funds } = await supabase
    .from('funds')
    .select('id, canonical_name');
  // Fetch known companies for matching
  const { data: companies } = await supabase
    .from('companies')
    .select('id, canonical_name, canonical_domain');
  const knownCompanies = new Map<string, string>();
  for (const c of companies || []) {
    knownCompanies.set(c.canonical_name.toLowerCase(), c.id);
    if (c.canonical_domain) {
      knownCompanies.set(c.canonical_domain.toLowerCase(), c.id);
    }
  }

  // Fetch stories with funding event type that have document versions
  const { data: stories } = await supabase
    .from('stories')
    .select(`
      id,
      headline,
      summary,
      event_date,
      publisher,
      source_urls,
      verification_label,
      story_sources (source_url, publisher, published_at, document_version_id),
      story_companies (company_id, companies!inner (canonical_name)),
      story_investors (fund_id, role, funds!inner (canonical_name))
    `)
    .eq('event_type', 'funding')
    .in('verification_label', ['verified', 'partial'])
    .order('event_date', { ascending: false })
    .limit(200);

  if (!stories?.length) {
    console.log('No funding stories found');
    return;
  }

  const extractedEvents: FundingEvent[] = [];

  for (const story of stories) {
    // Collect document versions from story sources
    const storySources = story.story_sources || [];
    const documentVersions = storySources
      .map((s: { document_version_id: string | null; source_url: string }) => ({
        id: s.document_version_id,
        source_url: s.source_url,
      }))
      .filter((d): d is { id: string; source_url: string } => d.id !== null);

    if (documentVersions.length === 0) {
      console.log(`Story ${story.id} has no document versions, skipping`);
      continue;
    }

    // Fetch normalized text from document versions
    const dvIds = documentVersions.map(dv => dv.id);
    const { data: docVersions } = await supabase
      .from('document_versions')
      .select('id, normalized_text, source_document_id, metadata')
      .in('id', dvIds);

    if (!docVersions?.length) {
      console.log(`No document versions found for story ${story.id}`);
      continue;
    }

    // Map document versions by ID for per-document processing
    const docVersionMap = new Map(docVersions.map(dv => [dv.id, dv]));

    const allUrls = [...new Set([
      ...story.source_urls || [],
      ...documentVersions.map(dv => dv.source_url).filter(Boolean)
    ])];

    // Match companies
    const companyNames = (story.story_companies || []).map((sc: { companies?: { canonical_name: string } | { canonical_name: string }[] | null }) => relatedName(sc.companies)).filter(Boolean);
    const companyName = companyNames[0] || 'Unknown';
    const companyId = knownCompanies.get(companyName.toLowerCase()) || null;

    // A name mention is not evidence of participation in this particular round.
    const storyInvestors = story.story_investors || [];
    const leadInvestors = storyInvestors.filter((si: { role: string; funds?: { canonical_name: string } | { canonical_name: string }[] | null }) => si.role === 'lead')
      .map((si: { funds?: { canonical_name: string } | { canonical_name: string }[] | null }) => relatedName(si.funds)).filter(Boolean) as string[];
    const participantInvestors = storyInvestors.filter((si: { role: string }) => si.role === 'participant')
      .map((si: { funds?: { canonical_name: string } | { canonical_name: string }[] | null }) => relatedName(si.funds)).filter(Boolean) as string[];

    const parsedAmounts = docVersions
      .map(dv => parseAmount(dv.normalized_text))
      .filter((value): value is { amount: number; currency: string } => value !== null);
    const parsedStages = docVersions
      .map(dv => dv.normalized_text.match(/(pre-?seed|seed|series [a-e]|growth|late.?stage|ipo|public|acquisition|grant|debt|convertible|safe)/i)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(normalizeStage)
      .filter(stage => stage !== 'other');
    const selectedAmount = mostFrequent(parsedAmounts.map(value => value.amount), 0);

    const event: FundingEvent = {
      company_name: companyName,
      company_id: companyId,
      announced_date: story.event_date || new Date().toISOString(),
      round_stage: mostFrequent(parsedStages, 'other'),
      amount_usd: selectedAmount > 0 ? selectedAmount : undefined,
      amount_currency: 'USD',
      lead_investors: leadInvestors,
      participant_investors: participantInvestors,
      source_urls: allUrls,
      document_versions: docVersions.map(dv => ({ id: dv.id, normalized_text: dv.normalized_text })),
      verification_status: story.verification_label === 'verified' ? 'verified' : 'partial',
      conflicts: [],
    };

    extractedEvents.push(event);
  }

  // Detect conflicts
  const conflicts = detectConflicts(extractedEvents);
  for (const conflict of conflicts) {
    for (const event of extractedEvents) {
      if (event.source_urls[0] === conflict.source_a || event.source_urls[0] === conflict.source_b) {
        event.conflicts.push(conflict);
        event.verification_status = 'conflicted';
      }
    }
  }

  // Process each event: create model run, claims, evidence, evaluate publication, bind fields
  for (const event of extractedEvents) {
    if (!event.company_id) {
      console.log(`Company not found: ${event.company_name}`);
      continue;
    }

    // Create deterministic model run for this extraction (using first document version as reference)
    const inputChecksum = evidenceCore.computeContentHash(
      event.document_versions.map(dv => dv.normalized_text).join('\n\n---\n\n') + event.company_name
    );
    const modelRun = await evidenceCore.repository.createModelRun({
      run_kind: 'deterministic_extraction',
      provider: null,
      model: null,
      prompt_version: null,
      schema_version: '1.0',
      implementation_version: IMPLEMENTATION_VERSION,
      input_checksum: inputChecksum,
      document_version_id: event.document_versions[0]?.id || null,
      tokens_input: null,
      tokens_output: null,
      latency_ms: 0,
      cost_usd: 0,
      status: 'success',
    });

    // Upsert funding round
    const { data: round, error: roundError } = await supabase
      .from('funding_rounds')
      .upsert({
        company_id: event.company_id,
        announced_date: event.announced_date,
        round_stage: event.round_stage,
        amount_usd: event.amount_usd,
        amount_currency: event.amount_currency,
        amount_source_url: event.source_urls[0],
        lead_investor_ids: [],
        source_urls: event.source_urls,
        verification_status: event.verification_status,
        conflicts: event.conflicts.length > 0 ? event.conflicts : null,
      }, { onConflict: 'company_id,announced_date,round_stage' })
      .select()
      .single();

    if (roundError) {
      console.error('Failed to upsert round:', roundError.message);
      continue;
    }

    // Upsert participants and create claims with evidence
    const allInvestors = [...event.lead_investors, ...event.participant_investors];
    const leadInvestorIds: string[] = [];

    for (const investorName of allInvestors) {
      const fund = funds?.find(f => f.canonical_name === investorName);
      if (!fund) continue;

      const role = event.lead_investors.includes(investorName) ? 'lead' : 'participant';
      if (role === 'lead') leadInvestorIds.push(fund.id);

      // Upsert participant and get the actual participant ID
      const { data: participant, error: participantError } = await supabase
        .from('round_participants')
        .upsert({
          round_id: round.id,
          fund_id: fund.id,
          role,
          source_urls: event.source_urls,
          verification_status: event.verification_status,
        }, { onConflict: 'round_id,fund_id,fund_vehicle_id' })
        .select('id')
        .single();

      if (participantError) {
        console.error('Failed to upsert participant:', participantError.message);
        continue;
      }

      // Only create participation claim for explicit lead/participant roles, NOT for "mentioned"
      if (role === 'lead' || role === 'participant') {
        // Find spans in each document version for this investor
        const evidenceItems: Array<{
          document_version_id: string;
          stance: 'supports';
          span_start: number;
          span_end: number;
          excerpt: string;
          excerpt_checksum: string;
          extractor_confidence: number;
        }> = [];

        for (const dv of event.document_versions) {
          const spans = findSpansInText(dv.normalized_text, [investorName], 0.85);
          for (const span of spans) {
            evidenceItems.push({
              document_version_id: dv.id,
              stance: 'supports' as const,
              span_start: span.start,
              span_end: span.end,
              excerpt: span.excerpt,
              excerpt_checksum: span.checksum,
              extractor_confidence: 0.85,
            });
          }
        }

        if (evidenceItems.length > 0) {
          await evidenceCore.repository.createClaimWithEvidence({
            subject_type: 'round_participant',
            subject_id: participant.id,
            claim_type: 'investor_participation',
            predicate: 'participated_in',
            value_json: { fund_id: fund.id, role },
            effective_at: event.announced_date,
            extraction_confidence: 0.85,
            resolution_confidence: 0.95,
            model_run_id: modelRun.id,
            evidence_items: evidenceItems,
            binding_record_type: 'round_participant',
            binding_record_id: participant.id,
            binding_field_name: 'role',
          });
        }
      }
    }

    // Create claims for funding round fields (per document version)
    const roundClaims: Array<{
      claim_type: 'funding_amount' | 'funding_stage' | 'announced_date';
      predicate: string;
      value_json: Record<string, unknown>;
      extraction_confidence: number;
      search_terms: string[];
    }> = [];

    // We'll collect amount/stage/date from each document and create claims per document
    for (const dv of event.document_versions) {
      const text = dv.normalized_text;
      
      // Parse amount from this document
      const amountInfo = parseAmount(text);
      if (amountInfo?.amount) {
        roundClaims.push({
          claim_type: 'funding_amount',
          predicate: 'amount_usd',
          value_json: { amount_usd: amountInfo.amount, currency: amountInfo.currency },
          extraction_confidence: 0.9,
          search_terms: [`$${amountInfo.amount}`, `${amountInfo.amount / 1_000_000}M`],
        });
      }

      // Normalize stage from this document
      const stageMatch = text.match(/(pre-?seed|seed|series [a-e]|growth|late.?stage|ipo|public|acquisition|grant|debt|convertible|safe)/i);
      if (stageMatch) {
        const normalizedStage = normalizeStage(stageMatch[1]);
        if (normalizedStage !== 'other') {
          roundClaims.push({
            claim_type: 'funding_stage',
            predicate: 'round_stage',
            value_json: { stage: normalizedStage },
            extraction_confidence: 0.9,
            search_terms: [stageMatch[1]],
          });
        }
      }

      // Announced date from this document
      roundClaims.push({
        claim_type: 'announced_date',
        predicate: 'announced_date',
        value_json: { date: event.announced_date },
        extraction_confidence: 0.95,
        search_terms: [new Date(event.announced_date).toLocaleDateString()],
      });
    }

    // Deduplicate claims by predicate + value_json (same claim from multiple docs)
    const seenClaims = new Set<string>();
    const uniqueRoundClaims: typeof roundClaims = [];
    for (const claim of roundClaims) {
      const key = `${claim.predicate}:${JSON.stringify(claim.value_json)}`;
      if (!seenClaims.has(key)) {
        seenClaims.add(key);
        uniqueRoundClaims.push(claim);
      }
    }

    for (const claimSpec of uniqueRoundClaims) {
      // Find spans in each document version
      const evidenceItems: Array<{
        document_version_id: string;
        stance: 'supports';
        span_start: number;
        span_end: number;
        excerpt: string;
        excerpt_checksum: string;
        extractor_confidence: number;
      }> = [];

      for (const dv of event.document_versions) {
        const spans = findSpansInText(dv.normalized_text, claimSpec.search_terms, claimSpec.extraction_confidence);
        for (const span of spans) {
          evidenceItems.push({
            document_version_id: dv.id,
            stance: 'supports' as const,
            span_start: span.start,
            span_end: span.end,
            excerpt: span.excerpt,
            excerpt_checksum: span.checksum,
            extractor_confidence: claimSpec.extraction_confidence,
          });
        }
      }

      if (evidenceItems.length === 0) continue;

      await evidenceCore.repository.createClaimWithEvidence({
        subject_type: 'funding_round',
        subject_id: round.id,
        claim_type: claimSpec.claim_type,
        predicate: claimSpec.predicate,
        value_json: claimSpec.value_json,
        effective_at: event.announced_date,
        extraction_confidence: claimSpec.extraction_confidence,
        resolution_confidence: 0.95,
        model_run_id: modelRun.id,
        evidence_items: evidenceItems,
        binding_record_type: 'funding_round',
        binding_record_id: round.id,
        binding_field_name: claimSpec.predicate,
      });
    }

    // Update round with lead investor IDs
    await supabase
      .from('funding_rounds')
      .update({ lead_investor_ids: leadInvestorIds })
      .eq('id', round.id);
  }

  console.log(`Processed ${extractedEvents.length} funding events with evidence`);
}

export async function computeInvestorGraph(): Promise<void> {
  // Materialized view is automatic via investment_graph
  console.log('Investment graph view ready');
}
