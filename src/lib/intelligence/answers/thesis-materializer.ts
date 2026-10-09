/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { canonicalizeUrl } from '@/lib/intelligence/evidence/canonical-url';
import { evidenceRepository } from '@/lib/intelligence/evidence/repository';
import { normalizeText } from '@/lib/intelligence/evidence/normalization';
import { createEvidenceItem, findExactSpan } from '@/lib/intelligence/evidence/spans';
import { confidenceLabel } from './confidence';
import { fingerprint } from './hash';

type Row = Record<string, any>;

const THESIS_THEME_RULES: Array<[string, RegExp]> = [
  ['foundation_models', /foundation model|large language model|\bllm\b|model lab/i],
  ['infrastructure', /infrastructure|compute|cloud|data stack|ai stack/i],
  ['developer_tools', /developer|tooling|platform|abstraction layer/i],
  ['applications', /application|product|software|workflow/i],
  ['enterprise_ai', /enterprise|b2b|business/i],
  ['cybersecurity', /cyber|security|defen[cs]e/i],
  ['healthcare', /health|clinical|biotech|medical/i],
  ['robotics', /robot|autonom|physical ai/i],
  ['research', /research|scientist|breakthrough/i],
];

export function extractThesisThemes(text: string): string[] {
  const themes = THESIS_THEME_RULES.filter(([, rule]) => rule.test(text)).map(([theme]) => theme);
  return themes.length ? themes : ['ai_first_companies'];
}

async function ensureOfficialConnector(input: { fundId: string; fundName: string; url: string }): Promise<string> {
  const canonical = canonicalizeUrl(input.url);
  const sourceId = `official-thesis-${input.fundId}`;
  const { error } = await ingestionSupabase.from('source_connectors').upsert({
    source_id: sourceId,
    name: `${input.fundName} official thesis`,
    category: 'vc_blog',
    base_url: `https://${canonical.domain}`,
    access_method: 'html',
    auth_required: 'none',
    robots_txt_allows: 'conditional',
    reuse_permission: 'summary_only',
    attribution_required: true,
    commercial_use_allowed: 'unclear',
    expected_fact_types: ['thesis_statement'],
    cadence: 'weekly',
    status: 'approved',
    trust_tier: 'official',
    is_official: true,
    independence_group: canonical.domain,
  }, { onConflict: 'source_id' });
  if (error) throw new Error(`THESIS_CONNECTOR_WRITE_FAILED:${error.message}`);
  return sourceId;
}

async function ensureStatedThesisClaims(): Promise<number> {
  const { data: excerpts, error } = await ingestionSupabase.from('stated_thesis').select(`
    id, fund_id, text, source_url, source_type, date_stated, extracted_at,
    funds!inner(id, canonical_name)
  `).limit(2000);
  if (error) throw new Error(`STATED_THESIS_LEGACY_READ_FAILED:${error.message}`);
  const { data: currentClaims, error: claimsError } = await ingestionSupabase.from('claims')
    .select('id,subject_id,predicate,value_json,publication_status')
    .eq('subject_type', 'fund').eq('claim_type', 'thesis_statement').limit(5000);
  if (claimsError) throw new Error(`STATED_THESIS_CLAIM_READ_FAILED:${claimsError.message}`);
  const existing = new Set((currentClaims ?? []).map((claim: Row) => `${claim.subject_id}:${claim.value_json?.source_url ?? ''}:${claim.value_json?.text ?? ''}`));
  let created = 0;
  for (const excerpt of (excerpts ?? []) as Row[]) {
    const dedupeKey = `${excerpt.fund_id}:${excerpt.source_url}:${excerpt.text}`;
    if (existing.has(dedupeKey)) continue;
    const canonical = canonicalizeUrl(excerpt.source_url);
    const normalized = normalizeText(excerpt.text);
    if (!normalized.normalizedText) continue;
    const sourceId = await ensureOfficialConnector({
      fundId: excerpt.fund_id,
      fundName: excerpt.funds?.canonical_name ?? 'Tracked investor',
      url: canonical.canonicalUrl,
    });
    const persisted = await evidenceRepository.persistDocumentVersion({
      source_id: sourceId,
      canonical_url: canonical.canonicalUrl,
      domain: canonical.domain,
      title: `${excerpt.funds?.canonical_name ?? 'Investor'} thesis excerpt`,
      publisher: excerpt.funds?.canonical_name ?? null,
      raw_content: excerpt.text,
      normalized_text: normalized.normalizedText,
      normalization_version: 1,
      fetched_at: excerpt.extracted_at ?? new Date().toISOString(),
      published_at: excerpt.date_stated ?? null,
      r2_key: null,
      r2_url: null,
      rights_snapshot: { can_store_raw: true, can_store_full_text: false, excerpt_only: true, attribution_required: true },
      metadata: { content_kind: 'official_thesis_excerpt', stated_thesis_id: excerpt.id, source_type: excerpt.source_type },
      archive_id: randomUUID(),
    });
    const run = await evidenceRepository.createModelRun({
      run_kind: 'deterministic_extraction',
      implementation_version: 'stated-thesis-bridge-v1',
      input_checksum: normalized.checksum,
      document_version_id: persisted.documentVersionId,
    });
    const span = findExactSpan(normalized.normalizedText, normalized.normalizedText);
    if (!span) throw new Error('STATED_THESIS_SPAN_NOT_FOUND');
    const result = await evidenceRepository.createClaimWithEvidence({
      subject_type: 'fund',
      subject_id: excerpt.fund_id,
      claim_type: 'thesis_statement',
      predicate: 'stated_thesis',
      value_json: {
        text: excerpt.text,
        themes: extractThesisThemes(excerpt.text),
        source_url: canonical.canonicalUrl,
        source_type: excerpt.source_type,
      },
      effective_at: excerpt.date_stated ?? null,
      extraction_confidence: 0.98,
      resolution_confidence: 1,
      model_run_id: run.id,
      evidence_items: [createEvidenceItem(persisted.documentVersionId, span, 'supports', 0.98)],
    });
    if (result.publicationStatus !== 'published') {
      throw new Error(`STATED_THESIS_NOT_PUBLISHED:${result.publicationReason}`);
    }
    existing.add(dedupeKey);
    created++;
  }
  return created;
}

function themeNames(themes: unknown): string[] {
  if (!Array.isArray(themes)) return [];
  return themes.map(theme => typeof theme === 'object' && theme && 'theme' in theme ? String((theme as Row).theme) : '').filter(Boolean);
}

async function previousThesis(fundId: string, kind: 'stated' | 'observed', inputFingerprint: string): Promise<Row | null> {
  const { data, error } = await ingestionSupabase.from('thesis_records').select('id,themes,input_fingerprint')
    .eq('fund_id', fundId).eq('thesis_kind', kind).eq('status', 'published')
    .neq('input_fingerprint', inputFingerprint).order('computed_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`THESIS_HISTORY_READ_FAILED:${error.message}`);
  return data as Row | null;
}

function themeChanges(previous: Row | null, currentThemes: Array<{ theme: string }>): { addedThemes: string[]; removedThemes: string[] } {
  const before = new Set(themeNames(previous?.themes));
  const after = new Set(themeNames(currentThemes));
  return {
    addedThemes: [...after].filter(theme => !before.has(theme)),
    removedThemes: [...before].filter(theme => !after.has(theme)),
  };
}

async function retirePreviousThesis(previous: Row | null, currentId: string): Promise<void> {
  if (!previous?.id || previous.id === currentId) return;
  const { error } = await ingestionSupabase.from('thesis_records').update({ status: 'retired' }).eq('id', previous.id);
  if (error) throw new Error(`THESIS_HISTORY_RETIRE_FAILED:${error.message}`);
}

async function replaceThesisClaims(thesisRecordId: string, links: Array<{ claim_id: string; claim_evidence_id?: string | null; stance: string }>) {
  const { error: deleteError } = await ingestionSupabase.from('thesis_record_claims').delete().eq('thesis_record_id', thesisRecordId);
  if (deleteError) throw new Error(`THESIS_CITATION_DELETE_FAILED:${deleteError.message}`);
  if (links.length === 0) return;
  const { error } = await ingestionSupabase.from('thesis_record_claims').insert(links.map(link => ({ thesis_record_id: thesisRecordId, ...link })));
  if (error) throw new Error(`THESIS_CITATION_INSERT_FAILED:${error.message}`);
}

export async function materializeStatedThesisRecords(): Promise<number> {
  await ensureStatedThesisClaims();
  const { data, error } = await ingestionSupabase.from('claims').select(`
    id, subject_id, value_json, extraction_confidence, resolution_confidence,
    claim_evidence!claim_evidence_claim_id_fkey(
      id, stance,
      document_versions!claim_evidence_document_version_id_fkey(
        source_documents!document_versions_source_document_id_fkey(
          source_connectors!source_documents_source_id_fkey(is_official)
        )
      )
    )
  `).eq('subject_type', 'fund').eq('claim_type', 'thesis_statement').eq('publication_status', 'published').limit(2000);
  if (error) throw new Error(`STATED_THESIS_INPUT_FAILED:${error.message}`);
  const byFund = new Map<string, Row[]>();
  for (const claim of (data ?? []) as Row[]) {
    const officialEvidence = (claim.claim_evidence ?? []).filter((evidence: Row) =>
      evidence.stance === 'supports' && evidence.document_versions?.source_documents?.source_connectors?.is_official === true,
    );
    if (officialEvidence.length === 0) continue;
    byFund.set(claim.subject_id, [...(byFund.get(claim.subject_id) ?? []), { ...claim, officialEvidence }]);
  }
  let written = 0;
  for (const [fundId, claims] of byFund) {
    const claimIds = claims.map(claim => claim.id).sort();
    const inputFingerprint = fingerprint({ kind: 'stated', fundId, claimIds, methodology: 'published-official-claims-v1' });
    const confidence = Math.min(...claims.map(claim => Math.min(Number(claim.extraction_confidence), Number(claim.resolution_confidence))));
    const themes = claims.flatMap(claim => {
      const value = claim.value_json ?? {};
      const raw = value.themes ?? value.theme ?? [];
      return (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map((theme: string) => ({ theme }));
    });
    const previous = await previousThesis(fundId, 'stated', inputFingerprint);
    const changes = themeChanges(previous, themes);
    const { data: record, error: upsertError } = await ingestionSupabase.from('thesis_records').upsert({
      fund_id: fundId,
      thesis_kind: 'stated',
      status: 'published',
      methodology_version: 'published-official-claims-v1',
      input_fingerprint: inputFingerprint,
      sample_size: 0,
      covered_investment_count: 0,
      coverage_ratio: 1,
      confidence_score: confidence,
      confidence_label: confidenceLabel(confidence),
      themes,
      summary: { claimCount: claims.length, ...changes },
      caveats: [],
      counter_evidence: [],
      supersedes_id: previous?.id ?? null,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'fund_id,thesis_kind,input_fingerprint' }).select('id').single();
    if (upsertError) throw new Error(`STATED_THESIS_WRITE_FAILED:${upsertError.message}`);
    await replaceThesisClaims(record.id, claims.flatMap(claim => claim.officialEvidence.map((evidence: Row) => ({
      claim_id: claim.id,
      claim_evidence_id: evidence.id,
      stance: evidence.stance,
    }))));
    await retirePreviousThesis(previous, record.id);
    written++;
  }
  return written;
}

export async function materializeObservedThesisRecords(): Promise<number> {
  const { data, error } = await ingestionSupabase.from('investment_graph').select('*')
    .eq('round_verification', 'verified').eq('participant_verification', 'verified').order('announced_date', { ascending: true }).limit(10000);
  if (error) throw new Error(`OBSERVED_THESIS_INPUT_FAILED:${error.message}`);
  const events = (data ?? []) as Row[];
  const roundIds = [...new Set(events.map(event => event.round_id))];
  const { data: bindings, error: bindingError } = roundIds.length
    ? await ingestionSupabase.from('claim_bindings').select('record_id,claim_id,claims!inner(id,publication_status,claim_evidence!claim_evidence_claim_id_fkey(id,stance))')
      .eq('record_type', 'funding_round').in('record_id', roundIds).eq('claims.publication_status', 'published').limit(20000)
    : { data: [], error: null };
  if (bindingError) throw new Error(`OBSERVED_THESIS_EVIDENCE_FAILED:${bindingError.message}`);
  const byRound = new Map<string, Row[]>();
  for (const binding of (bindings ?? []) as Row[]) byRound.set(binding.record_id, [...(byRound.get(binding.record_id) ?? []), binding]);
  const byFund = new Map<string, Row[]>();
  for (const event of events) {
    if (!(byRound.get(event.round_id)?.length)) continue;
    byFund.set(event.fund_id, [...(byFund.get(event.fund_id) ?? []), event]);
  }
  let written = 0;
  const writtenFunds = new Set<string>();
  for (const [fundId, fundEvents] of byFund) {
    if (fundEvents.length < 3) continue;
    const themeCounts = new Map<string, { companies: Set<string>; deals: number }>();
    for (const event of fundEvents) for (const theme of event.company_ai_tags ?? []) {
      const current = themeCounts.get(theme) ?? { companies: new Set<string>(), deals: 0 };
      current.companies.add(event.company_id); current.deals++; themeCounts.set(theme, current);
    }
    const themes = [...themeCounts.entries()].map(([theme, value]) => ({
      theme,
      companyCount: value.companies.size,
      dealCount: value.deals,
      percentage: Number(((value.deals / fundEvents.length) * 100).toFixed(2)),
    })).sort((a, b) => b.dealCount - a.dealCount);
    const links = fundEvents.flatMap(event => (byRound.get(event.round_id) ?? []).flatMap(binding =>
      (binding.claims?.claim_evidence ?? []).filter((evidence: Row) => evidence.stance === 'supports').map((evidence: Row) => ({
        claim_id: binding.claim_id,
        claim_evidence_id: evidence.id,
        stance: 'supports',
      })),
    ));
    if (links.length === 0) continue;
    const periodStart = fundEvents[0].announced_date;
    const periodEnd = fundEvents[fundEvents.length - 1].announced_date;
    const inputFingerprint = fingerprint({ kind: 'observed', fundId, rounds: fundEvents.map(event => event.round_id).sort(), methodology: 'verified-investment-themes-v1' });
    const coverageRatio = Math.min(1, new Set(fundEvents.map(event => event.round_id)).size / fundEvents.length);
    const score = Math.min(0.95, 0.45 + Math.min(0.35, fundEvents.length / 40) + coverageRatio * 0.15);
    const previous = await previousThesis(fundId, 'observed', inputFingerprint);
    const changes = themeChanges(previous, themes);
    const { data: record, error: upsertError } = await ingestionSupabase.from('thesis_records').upsert({
      fund_id: fundId,
      thesis_kind: 'observed',
      status: 'published',
      period_start: periodStart,
      period_end: new Date(new Date(periodEnd).getTime() + 1).toISOString(),
      methodology_version: 'verified-investment-themes-v1',
      input_fingerprint: inputFingerprint,
      sample_size: fundEvents.length,
      covered_investment_count: fundEvents.length,
      coverage_ratio: coverageRatio,
      confidence_score: Number(score.toFixed(4)),
      confidence_label: confidenceLabel(score),
      themes,
      summary: { investmentCount: fundEvents.length, ...changes },
      caveats: ['Observed thesis is inferred from published verified investments and is not an investor quote.'],
      counter_evidence: [],
      supersedes_id: previous?.id ?? null,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'fund_id,thesis_kind,input_fingerprint' }).select('id').single();
    if (upsertError) throw new Error(`OBSERVED_THESIS_WRITE_FAILED:${upsertError.message}`);
    const uniqueLinks = [...new Map(links.map(link => [`${link.claim_id}:${link.stance}`, link])).values()];
    await replaceThesisClaims(record.id, uniqueLinks);
    await retirePreviousThesis(previous, record.id);
    writtenFunds.add(fundId);
    written++;
  }

  // Funding announcements can be sparse while official portfolio pages already provide
  // strong behavioral evidence. Use those relationships as a separate, clearly-labelled
  // observed-thesis methodology rather than pretending that they are dated rounds.
  const { data: portfolioRows, error: portfolioError } = await ingestionSupabase.from('fund_portfolio').select(`
    id, fund_id, company_id, verification_status, source_url, last_verified_at, updated_at,
    companies!inner(id, canonical_name, ai_tags),
    funds!inner(id, canonical_name)
  `).in('verification_status', ['verified', 'partial']).limit(10000);
  if (portfolioError) throw new Error(`OBSERVED_PORTFOLIO_INPUT_FAILED:${portfolioError.message}`);
  const { data: portfolioClaims, error: portfolioClaimError } = await ingestionSupabase.from('claims').select(`
    id, subject_id, value_json, publication_status,
    claim_evidence!claim_evidence_claim_id_fkey(id,stance)
  `).eq('subject_type', 'fund').eq('claim_type', 'other').eq('predicate', 'portfolio_company')
    .eq('publication_status', 'published').limit(20000);
  if (portfolioClaimError) throw new Error(`OBSERVED_PORTFOLIO_EVIDENCE_FAILED:${portfolioClaimError.message}`);
  const claimByRelationship = new Map<string, Row>();
  for (const claim of (portfolioClaims ?? []) as Row[]) {
    claimByRelationship.set(`${claim.subject_id}:${claim.value_json?.company_id ?? ''}`, claim);
  }
  const portfolioByFund = new Map<string, Row[]>();
  for (const row of (portfolioRows ?? []) as Row[]) {
    if (writtenFunds.has(row.fund_id)) continue;
    const claim = claimByRelationship.get(`${row.fund_id}:${row.company_id}`);
    if (!claim || !(claim.claim_evidence ?? []).some((item: Row) => item.stance === 'supports')) continue;
    portfolioByFund.set(row.fund_id, [...(portfolioByFund.get(row.fund_id) ?? []), { ...row, claim }]);
  }
  for (const [fundId, relationships] of portfolioByFund) {
    if (relationships.length < 3) continue;
    const themeCounts = new Map<string, { companies: Set<string>; relationships: number }>();
    for (const relationship of relationships) for (const theme of relationship.companies?.ai_tags ?? []) {
      const current = themeCounts.get(theme) ?? { companies: new Set<string>(), relationships: 0 };
      current.companies.add(relationship.company_id);
      current.relationships++;
      themeCounts.set(theme, current);
    }
    const themes = [...themeCounts.entries()].map(([theme, value]) => ({
      theme,
      companyCount: value.companies.size,
      dealCount: value.relationships,
      percentage: Number(((value.relationships / relationships.length) * 100).toFixed(2)),
    })).sort((a, b) => b.dealCount - a.dealCount);
    if (themes.length === 0) continue;
    const timestamps = relationships.map(row => row.last_verified_at ?? row.updated_at).filter(Boolean).sort();
    const periodStart = timestamps[0] ?? new Date().toISOString();
    const periodEnd = new Date(new Date(timestamps[timestamps.length - 1] ?? periodStart).getTime() + 1).toISOString();
    const relationshipIds = relationships.map(row => row.id).sort();
    const inputFingerprint = fingerprint({ kind: 'observed', fundId, relationshipIds, methodology: 'official-portfolio-themes-v1' });
    const verifiedCount = relationships.filter(row => row.verification_status === 'verified').length;
    const coverageRatio = verifiedCount / relationships.length;
    const score = Math.min(0.9, 0.55 + Math.min(0.2, relationships.length / 50) + coverageRatio * 0.15);
    const previous = await previousThesis(fundId, 'observed', inputFingerprint);
    const changes = themeChanges(previous, themes);
    const { data: record, error: upsertError } = await ingestionSupabase.from('thesis_records').upsert({
      fund_id: fundId,
      thesis_kind: 'observed',
      status: 'published',
      period_start: periodStart,
      period_end: periodEnd,
      methodology_version: 'official-portfolio-themes-v1',
      input_fingerprint: inputFingerprint,
      sample_size: relationships.length,
      covered_investment_count: relationships.length,
      coverage_ratio: coverageRatio,
      confidence_score: Number(score.toFixed(4)),
      confidence_label: confidenceLabel(score),
      themes,
      summary: { portfolioRelationshipCount: relationships.length, verifiedRelationshipCount: verifiedCount, ...changes },
      caveats: ['Observed thesis is inferred from companies listed on official investor portfolio pages; it does not imply investment date, round, check size, or current ownership.'],
      counter_evidence: [],
      supersedes_id: previous?.id ?? null,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'fund_id,thesis_kind,input_fingerprint' }).select('id').single();
    if (upsertError) throw new Error(`OBSERVED_PORTFOLIO_WRITE_FAILED:${upsertError.message}`);
    const links = relationships.flatMap(relationship => (relationship.claim.claim_evidence ?? [])
      .filter((item: Row) => item.stance === 'supports')
      .map((item: Row) => ({ claim_id: relationship.claim.id, claim_evidence_id: item.id, stance: 'supports' })));
    await replaceThesisClaims(record.id, [...new Map(links.map(link => [`${link.claim_id}:${link.claim_evidence_id}`, link])).values()]);
    await retirePreviousThesis(previous, record.id);
    written++;
  }
  return written;
}

export async function materializeThesisRecords(): Promise<{ stated: number; observed: number }> {
  const [stated, observed] = await Promise.all([materializeStatedThesisRecords(), materializeObservedThesisRecords()]);
  return { stated, observed };
}
