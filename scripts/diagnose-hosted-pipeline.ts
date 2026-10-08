import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase credentials');

const db = createClient(url, key, { auth: { persistSession: false } });

async function count(table: string, processed?: boolean) {
  let query = db.from(table).select('*', { count: 'exact', head: true });
  if (typeof processed === 'boolean') query = query.eq('processed', processed);
  const { count: value, error } = await query;
  return error ? { error: error.message } : value;
}

async function main() {
  const counts = {
    archive_total: await count('source_archive'),
    archive_processed: await count('source_archive', true),
    archive_pending: await count('source_archive', false),
    document_versions: await count('document_versions'),
    stories: await count('stories'),
    story_sources: await count('story_sources'),
    claims: await count('claims'),
    funding_rounds: await count('funding_rounds'),
    round_participants: await count('round_participants'),
    thesis_records: await count('thesis_records'),
    patterns: await count('patterns'),
    answer_snapshots: await count('answer_snapshots'),
  };

  const { data: runs, error: runsError } = await db.from('pipeline_runs')
    .select('id,pipeline_type,status,requested_at,started_at,completed_at,failure_summary,total_items,completed_items,failed_items')
    .order('requested_at', { ascending: false }).limit(12);

  const runIds = (runs ?? []).map(run => run.id);
  const { data: stages, error: stagesError } = runIds.length
    ? await db.from('stage_attempts')
      .select('pipeline_run_id,stage_name,status,attempt_number,items_processed,items_succeeded,items_failed,error_code,error_message,retry_after,lease_expires_at,updated_at')
      .in('pipeline_run_id', runIds).order('updated_at', { ascending: false }).limit(80)
    : { data: [], error: null };

  const { data: pendingSamples, error: pendingError } = await db.from('source_archive')
    .select('id,source_id,url,content_hash,fetched_at,processed,metadata,raw_content,document_version_id')
    .eq('processed', false).order('fetched_at', { ascending: false }).limit(5);

  const { error: thesisRelationError } = await db.from('claims').select(`
    id,
    claim_evidence!claim_evidence_claim_id_fkey(
      id,
      document_versions!claim_evidence_document_version_id_fkey(
        source_documents!document_versions_source_document_id_fkey(
          source_connectors!source_documents_source_id_fkey(is_official)
        )
      )
    )
  `).limit(1);

  const { count: officialSourceCount, error: trustError } = await db.from('source_connectors')
    .select('*', { count: 'exact', head: true }).eq('is_official', true);

  console.log(JSON.stringify({
    counts,
    runs_error: runsError?.message ?? null,
    runs: runs ?? [],
    stages_error: stagesError?.message ?? null,
    stages: stages ?? [],
    pending_error: pendingError?.message ?? null,
    thesis_relation_error: thesisRelationError?.message ?? null,
    official_source_count: trustError ? { error: trustError.message } : officialSourceCount,
    pending_samples: (pendingSamples ?? []).map(item => ({
      ...item,
      raw_content_length: typeof item.raw_content === 'string' ? item.raw_content.length : null,
      raw_content: undefined,
    })),
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
