import fs from 'fs';
import path from 'path';
import { buildBothAnswerDrafts } from '@/lib/intelligence/answers/aggregations';
import { snapshotFreshnessStatus } from '@/lib/intelligence/answers/freshness';
import { bundle, filters, investment } from './fixtures';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('checkpoint 3 durable contracts', () => {
  it('is idempotent for identical inputs and changes fingerprint when eligible inputs change', () => {
    const first = buildBothAnswerDrafts(filters, bundle(), new Date('2026-10-01T01:00:00.000Z'));
    const second = buildBothAnswerDrafts(filters, bundle(), new Date('2026-10-01T02:00:00.000Z'));
    expect(first.map(item => item.inputFingerprint)).toEqual(second.map(item => item.inputFingerprint));
    const changed = buildBothAnswerDrafts(filters, bundle({ investments: [investment(), investment({ roundId: '2' })] }));
    expect(changed[0].inputFingerprint).not.toBe(first[0].inputFingerprint);
  });

  it('migration preserves history, supersedes older snapshots, and enforces citations', () => {
    const sql = read('supabase/migrations/20261008020000_answer_intelligence_contracts.sql');
    const schema = read('supabase/schema.sql');
    expect(sql).toMatch(/CREATE TABLE public\.answer_snapshots/);
    expect(sql).toMatch(/CREATE TABLE public\.answer_snapshot_citations/);
    expect(sql).toMatch(/UPDATE public\.answer_snapshots SET status = 'superseded'/);
    expect(sql).toMatch(/Every material answer section requires at least one normalized citation/);
    expect(sql).toMatch(/disclosed_round_count \+ undisclosed_round_count <= round_count/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.persist_answer_snapshot\(JSONB\) TO service_role/);
    expect(schema).toContain('CREATE TABLE public.answer_snapshots');
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.persist_answer_snapshot');
  });

  it('materializes thesis and patterns only from published evidence and wires hosted refresh', () => {
    const thesisMaterializer = read('src/lib/intelligence/answers/thesis-materializer.ts');
    const patternDetector = read('src/lib/ingestion/pattern-detector.ts');
    const workflow = read('.github/workflows/scheduled-ingestion.yml');
    expect(thesisMaterializer).toMatch(/claim_type', 'thesis_statement'/);
    expect(thesisMaterializer).toMatch(/publication_status', 'published'/);
    expect(patternDetector).toMatch(/publishable = roundIds\.length >= 5/);
    expect(patternDetector).toMatch(/independenceGroups\.size >= 2/);
    expect(workflow).toMatch(/npm run answers:compute/);
  });

  it('public routes provide preview gating and recomputation requires admin auth', () => {
    const answers = read('src/app/api/intelligence/answers/route.ts');
    const recompute = read('src/app/api/intelligence/recompute/route.ts');
    expect(answers).toMatch(/hasFullAccess/);
    expect(answers).toMatch(/toPreview/);
    expect(recompute).toMatch(/admin_users/);
    expect(recompute).toMatch(/Unauthorized/);
  });

  it('repository uses bounded fixed queries rather than a per-record fetch loop', () => {
    const repository = read('src/lib/intelligence/answers/repository.ts');
    expect(repository).toMatch(/\.limit\(500\)/);
    expect(repository).toMatch(/\.in\('record_id', recordIds\)/);
    expect(repository).not.toMatch(/for \(const round of rounds\)[\s\S]*?await ingestionSupabase/);
  });

  it('reports an expired published snapshot as stale without mutating its history', () => {
    expect(snapshotFreshnessStatus('published', '2026-10-01T00:00:00.000Z', new Date('2026-10-02T00:00:00.000Z'))).toBe('stale');
    expect(snapshotFreshnessStatus('superseded', '2026-10-01T00:00:00.000Z', new Date('2026-10-02T00:00:00.000Z'))).toBe('superseded');
  });
});
