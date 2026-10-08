import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { equalPreviousWindow } from './filters';
import { snapshotFreshnessStatus } from './freshness';
import type {
  AnswerCitation,
  AnswerFilters,
  AnswerInputBundle,
  AnswerSnapshotDraft,
  AnswerSnapshotRecord,
  InvestmentEvent,
  PatternRecordInput,
  ThesisRecordInput,
} from './types';

// Supabase is intentionally ungenerated in this repository; database rows are mapped at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function evidenceCitations(binding: Row): AnswerCitation[] {
  const claim = binding.claims;
  if (!claim || claim.publication_status !== 'published') return [];
  const evidence = asArray<Row>(claim.claim_evidence);
  if (evidence.length === 0) return [];
  return evidence.map(item => ({
    stance: item.stance ?? 'supports',
    claimId: claim.id,
    claimBindingId: binding.id,
    claimEvidenceId: item.id,
  }));
}

function mapSnapshot(row: Row): AnswerSnapshotRecord {
  const sections = asArray<Row>(row.answer_snapshot_sections)
    .sort((a, b) => a.position - b.position)
    .map(section => ({
      key: section.section_key,
      title: section.title,
      position: section.position,
      material: section.material,
      narrative: section.narrative,
      metrics: section.metrics ?? {},
      whyThis: section.why_this ?? {},
      citations: asArray<Row>(section.answer_snapshot_citations).map(citation => ({
        id: citation.id,
        stance: citation.stance,
        label: citation.label ?? undefined,
        claimId: citation.claim_id ?? undefined,
        claimBindingId: citation.claim_binding_id ?? undefined,
        claimEvidenceId: citation.claim_evidence_id ?? undefined,
        fundingRoundId: citation.funding_round_id ?? undefined,
        roundParticipantId: citation.round_participant_id ?? undefined,
        thesisRecordId: citation.thesis_record_id ?? undefined,
        patternId: citation.pattern_id ?? undefined,
      })),
    }));
  return {
    id: row.id,
    status: snapshotFreshnessStatus(row.status, row.stale_after),
    supersedesId: row.supersedes_id,
    kind: row.answer_kind,
    filters: {
      periodStart: row.period_start,
      periodEnd: row.period_end,
      domains: row.domains ?? [],
      geographies: row.geographies ?? [],
      stages: row.stages ?? [],
      fundId: row.fund_id,
      ycBatchId: row.yc_batch_id,
    },
    dataCutoffAt: row.data_cutoff_at,
    computedAt: row.computed_at,
    staleAfter: row.stale_after,
    schemaVersion: row.schema_version,
    methodologyVersion: row.methodology_version,
    filterFingerprint: row.filter_fingerprint,
    inputFingerprint: row.input_fingerprint,
    summary: row.summary ?? {},
    counts: {
      disclosedAmountUsd: Number(row.disclosed_amount_usd ?? 0),
      disclosedRoundCount: row.disclosed_round_count ?? 0,
      undisclosedRoundCount: row.undisclosed_round_count ?? 0,
      companyCount: row.company_count ?? 0,
      fundCount: row.fund_count ?? 0,
      roundCount: row.round_count ?? 0,
      thesisCount: row.thesis_count ?? 0,
      patternCount: row.pattern_count ?? 0,
    },
    coverage: row.coverage_metrics ?? {},
    confidence: { score: Number(row.confidence_score), label: row.confidence_label },
    caveats: row.caveats ?? [],
    counterEvidence: row.counter_evidence ?? [],
    sections,
  };
}

const SNAPSHOT_SELECT = `
  *,
  answer_snapshot_sections (
    id, section_key, title, position, material, narrative, metrics, why_this,
    answer_snapshot_citations (
      id, stance, label, claim_id, claim_binding_id, claim_evidence_id,
      funding_round_id, round_participant_id, thesis_record_id, pattern_id
    )
  )
`;

export async function loadAnswerInputBundle(filters: AnswerFilters): Promise<AnswerInputBundle> {
  const previous = equalPreviousWindow(filters);
  let roundsQuery = ingestionSupabase
    .from('funding_rounds')
    .select(`
      id, company_id, announced_date, round_stage, amount_usd, verification_status, source_urls, updated_at,
      companies!inner (id, canonical_name, ai_tags, hq_country, yc_batch),
      round_participants (id, fund_id, role, verification_status, funds (id, canonical_name))
    `)
    .eq('verification_status', 'verified')
    .gte('announced_date', previous.start)
    .lt('announced_date', filters.periodEnd)
    .order('announced_date', { ascending: false })
    .limit(500);
  if (filters.stages.length) roundsQuery = roundsQuery.in('round_stage', filters.stages);
  if (filters.fundId) roundsQuery = roundsQuery.eq('round_participants.fund_id', filters.fundId);

  const [roundsResult, thesesResult, patternsResult, connectorsResult, fetchLogsResult] = await Promise.all([
    roundsQuery,
    ingestionSupabase.from('thesis_records').select(`
      *, funds!inner(id, canonical_name),
      thesis_record_claims(claim_id, claim_evidence_id, stance, claims!inner(id, publication_status))
    `).eq('status', 'published').limit(500),
    ingestionSupabase.from('patterns').select(`
      id, name, description, status, time_window_start, time_window_end,
      baseline_window_start, baseline_window_end, sample_size, distinct_companies, distinct_funds,
      independent_source_count, methodology_version, input_fingerprint, coverage_metrics,
      counterexamples, sensitivity, filter_dimensions, updated_at,
      pattern_citations(claim_id, claim_evidence_id, stance, claims!inner(id, publication_status))
    `).in('status', ['published', 'corrected']).limit(500),
    ingestionSupabase.from('source_connectors').select('source_id').eq('status', 'approved').limit(1000),
    ingestionSupabase.from('source_fetch_logs').select('source_id').eq('status', 'success').gte('fetched_at', filters.periodStart).lt('fetched_at', filters.periodEnd).limit(5000),
  ]);
  for (const result of [roundsResult, thesesResult, patternsResult, connectorsResult, fetchLogsResult]) {
    if (result.error) throw new Error(`ANSWER_INPUT_QUERY_FAILED:${result.error.message}`);
  }

  const rounds = asArray<Row>(roundsResult.data);
  const roundIds = rounds.map(row => row.id);
  const participantIds = rounds.flatMap(row => asArray<Row>(row.round_participants).map(participant => participant.id));
  const recordIds = [...roundIds, ...participantIds];
  let bindings: Row[] = [];
  if (recordIds.length > 0) {
    const { data, error } = await ingestionSupabase.from('claim_bindings').select(`
      id, record_type, record_id, field_name,
      claims!inner(id, publication_status, claim_evidence(id, stance))
    `).in('record_id', recordIds).eq('claims.publication_status', 'published').limit(5000);
    if (error) throw new Error(`ANSWER_EVIDENCE_QUERY_FAILED:${error.message}`);
    bindings = asArray<Row>(data);
  }
  const citationsByRecord = new Map<string, AnswerCitation[]>();
  for (const binding of bindings) {
    citationsByRecord.set(binding.record_id, [
      ...(citationsByRecord.get(binding.record_id) ?? []),
      ...evidenceCitations(binding),
    ]);
  }

  const investments: InvestmentEvent[] = rounds.map(round => {
    const company = round.companies as Row;
    return {
      roundId: round.id,
      companyId: round.company_id,
      companyName: company?.canonical_name ?? 'Unknown company',
      announcedDate: round.announced_date,
      stage: round.round_stage,
      amountUsd: round.amount_usd === null ? null : Number(round.amount_usd),
      geography: company?.hq_country ?? null,
      domains: company?.ai_tags ?? [],
      ycBatchId: company?.yc_batch ?? null,
      verificationStatus: round.verification_status,
      sourceCoverage: Math.min(1, asArray<string>(round.source_urls).length / 2),
      citations: citationsByRecord.get(round.id) ?? [],
      participants: asArray<Row>(round.round_participants).map(participant => ({
        participantId: participant.id,
        fundId: participant.fund_id,
        fundName: participant.funds?.canonical_name ?? 'Unknown investor',
        role: participant.role,
        verificationStatus: participant.verification_status,
        citations: citationsByRecord.get(participant.id) ?? [],
      })),
    };
  });

  const theses: ThesisRecordInput[] = asArray<Row>(thesesResult.data).map(record => ({
    id: record.id,
    fundId: record.fund_id,
    fundName: record.funds?.canonical_name ?? 'Unknown investor',
    kind: record.thesis_kind,
    status: record.status,
    periodStart: record.period_start,
    periodEnd: record.period_end,
    methodologyVersion: record.methodology_version,
    sampleSize: record.sample_size,
    coverageRatio: Number(record.coverage_ratio),
    confidenceScore: Number(record.confidence_score),
    themes: record.themes ?? [],
    summary: record.summary ?? {},
    caveats: record.caveats ?? [],
    counterEvidence: record.counter_evidence ?? [],
    officialSource: record.thesis_kind === 'stated' && asArray<Row>(record.thesis_record_claims).length > 0,
    citations: asArray<Row>(record.thesis_record_claims)
      .filter(link => link.claims?.publication_status === 'published')
      .map(link => ({ stance: link.stance, claimId: link.claim_id, claimEvidenceId: link.claim_evidence_id, thesisRecordId: record.id })),
  }));

  const patterns: PatternRecordInput[] = asArray<Row>(patternsResult.data).map(record => ({
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    status: record.status,
    windowStart: record.time_window_start,
    windowEnd: record.time_window_end,
    baselineStart: record.baseline_window_start,
    baselineEnd: record.baseline_window_end,
    sampleSize: record.sample_size ?? 0,
    distinctCompanies: record.distinct_companies ?? 0,
    distinctFunds: record.distinct_funds ?? 0,
    independentSourceCount: record.independent_source_count ?? 0,
    methodologyVersion: record.methodology_version,
    inputFingerprint: record.input_fingerprint,
    coverageMetrics: record.coverage_metrics ?? {},
    counterexamples: record.counterexamples ?? [],
    sensitivity: record.sensitivity ?? {},
    filters: record.filter_dimensions ?? {},
    citations: asArray<Row>(record.pattern_citations)
      .filter(link => link.claims?.publication_status === 'published')
      .map(link => ({ stance: link.stance, claimId: link.claim_id, claimEvidenceId: link.claim_evidence_id, patternId: record.id })),
  }));

  const cutoffCandidates = [
    ...rounds.map(row => row.updated_at),
    ...asArray<Row>(thesesResult.data).map(row => row.computed_at),
    ...asArray<Row>(patternsResult.data).map(row => row.updated_at),
  ].filter(Boolean).map(value => new Date(value).getTime()).filter(value => Number.isFinite(value));
  return {
    investments,
    theses,
    patterns,
    dataCutoffAt: cutoffCandidates.length ? new Date(Math.max(...cutoffCandidates)).toISOString() : filters.periodEnd,
    expectedSourceCount: asArray<Row>(connectorsResult.data).length,
    observedSourceCount: new Set(asArray<Row>(fetchLogsResult.data).map(row => row.source_id)).size,
  };
}

function serializeDraft(draft: AnswerSnapshotDraft): Record<string, unknown> {
  return {
    answer_kind: draft.kind,
    period_start: draft.filters.periodStart,
    period_end: draft.filters.periodEnd,
    data_cutoff_at: draft.dataCutoffAt,
    computed_at: draft.computedAt,
    stale_after: draft.staleAfter,
    domains: draft.filters.domains,
    geographies: draft.filters.geographies,
    stages: draft.filters.stages,
    fund_id: draft.filters.fundId,
    yc_batch_id: draft.filters.ycBatchId,
    normalized_filters: draft.filters,
    filter_fingerprint: draft.filterFingerprint,
    input_fingerprint: draft.inputFingerprint,
    schema_version: draft.schemaVersion,
    methodology_version: draft.methodologyVersion,
    summary: draft.summary,
    disclosed_amount_usd: draft.counts.disclosedAmountUsd,
    disclosed_round_count: draft.counts.disclosedRoundCount,
    undisclosed_round_count: draft.counts.undisclosedRoundCount,
    company_count: draft.counts.companyCount,
    fund_count: draft.counts.fundCount,
    round_count: draft.counts.roundCount,
    thesis_count: draft.counts.thesisCount,
    pattern_count: draft.counts.patternCount,
    coverage_metrics: draft.coverage,
    confidence_score: draft.confidence.score,
    confidence_label: draft.confidence.label,
    caveats: draft.caveats,
    counter_evidence: draft.counterEvidence,
    sections: draft.sections.map(section => ({
      section_key: section.key,
      title: section.title,
      position: section.position,
      material: section.material,
      narrative: section.narrative,
      metrics: section.metrics,
      why_this: section.whyThis,
      citations: section.citations.map(citation => ({
        stance: citation.stance,
        label: citation.label,
        claim_id: citation.claimId,
        claim_binding_id: citation.claimBindingId,
        claim_evidence_id: citation.claimEvidenceId,
        funding_round_id: citation.fundingRoundId,
        round_participant_id: citation.roundParticipantId,
        thesis_record_id: citation.thesisRecordId,
        pattern_id: citation.patternId,
      })),
    })),
  };
}

export async function persistAnswerSnapshot(draft: AnswerSnapshotDraft): Promise<string> {
  const { data, error } = await ingestionSupabase.rpc('persist_answer_snapshot', { p_snapshot: serializeDraft(draft) });
  if (error) throw new Error(`ANSWER_SNAPSHOT_PERSIST_FAILED:${error.message}`);
  if (!data) throw new Error('ANSWER_SNAPSHOT_PERSIST_EMPTY');
  return data as string;
}

export async function getLatestAnswerSnapshot(kind: string, filterFingerprint: string): Promise<AnswerSnapshotRecord | null> {
  const { data, error } = await ingestionSupabase.from('answer_snapshots').select(SNAPSHOT_SELECT)
    .eq('answer_kind', kind).eq('filter_fingerprint', filterFingerprint).eq('status', 'published')
    .order('computed_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`ANSWER_SNAPSHOT_READ_FAILED:${error.message}`);
  return data ? mapSnapshot(data as Row) : null;
}

export async function getAnswerSnapshotById(id: string): Promise<AnswerSnapshotRecord | null> {
  const { data, error } = await ingestionSupabase.from('answer_snapshots').select(SNAPSHOT_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(`ANSWER_SNAPSHOT_READ_FAILED:${error.message}`);
  return data ? mapSnapshot(data as Row) : null;
}

export async function getAnswerFacets(): Promise<Record<string, string[]>> {
  const [companies, rounds, funds, batches] = await Promise.all([
    ingestionSupabase.from('companies').select('ai_tags,hq_country').eq('verification_status', 'verified').limit(2000),
    ingestionSupabase.from('funding_rounds').select('round_stage').eq('verification_status', 'verified').limit(2000),
    ingestionSupabase.from('funds').select('id,canonical_name').eq('verification_status', 'verified').limit(500),
    ingestionSupabase.from('yc_batches').select('id').order('year', { ascending: false }).limit(100),
  ]);
  for (const result of [companies, rounds, funds, batches]) if (result.error) throw new Error(`ANSWER_FACETS_FAILED:${result.error.message}`);
  return {
    domains: [...new Set(asArray<Row>(companies.data).flatMap(row => row.ai_tags ?? []))].sort(),
    geographies: [...new Set(asArray<Row>(companies.data).map(row => row.hq_country).filter(Boolean))].sort(),
    stages: [...new Set(asArray<Row>(rounds.data).map(row => row.round_stage).filter(Boolean))].sort(),
    funds: asArray<Row>(funds.data).map(row => `${row.id}:${row.canonical_name}`),
    ycBatches: asArray<Row>(batches.data).map(row => row.id),
  };
}
