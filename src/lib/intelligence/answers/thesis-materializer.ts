/* eslint-disable @typescript-eslint/no-explicit-any */
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { confidenceLabel } from './confidence';
import { fingerprint } from './hash';

type Row = Record<string, any>;

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
    written++;
  }
  return written;
}

export async function materializeThesisRecords(): Promise<{ stated: number; observed: number }> {
  const [stated, observed] = await Promise.all([materializeStatedThesisRecords(), materializeObservedThesisRecords()]);
  return { stated, observed };
}
