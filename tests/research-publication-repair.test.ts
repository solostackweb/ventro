import { readFileSync } from 'fs';
import { resolve } from 'path';
import { feedFilterSchema } from '@/lib/validators/schemas';
import { extractThesisThemes } from '@/lib/intelligence/answers/thesis-materializer';
import { buildMarketDemandHeadline } from '@/lib/intelligence/answers/aggregations';
import { fingerprint, parseAnswerFilters } from '@/lib/intelligence/answers/filters';
import { buildDashboardAnswerQuery } from '@/lib/intelligence/answers/request-query';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

describe('research publication repair', () => {
  it('accepts the URL-encoded feed filters emitted by the News page', () => {
    const parsed = feedFilterSchema.parse(Object.fromEntries(new URLSearchParams(
      'topics=foundation_models,research&geographies=us,global&event_types=funding&verified_only=true&page=2&limit=20',
    )));
    expect(parsed).toEqual(expect.objectContaining({
      topics: ['foundation_models', 'research'],
      geographies: ['us', 'global'],
      event_types: ['funding'],
      verified_only: true,
      page: 2,
      limit: 20,
    }));
  });

  it('adds the immutable document-version link required by normalization and extraction', () => {
    const migration = read('supabase/migrations/20261008060000_repair_story_publication_links.sql');
    expect(migration).toMatch(/ALTER TABLE public\.story_sources[\s\S]*ADD COLUMN IF NOT EXISTS document_version_id UUID/);
    expect(migration).toMatch(/idx_story_sources_document_version/);
    expect(migration).toMatch(/category IN \('vc_blog', 'company_blog', 'government', 'yc', 'corporate'\)[\s\S]*THEN TRUE/);
  });

  it('uses explicit foreign-key paths for every ambiguous stated-thesis embed', () => {
    const materializer = read('src/lib/intelligence/answers/thesis-materializer.ts');
    expect(materializer).toMatch(/document_versions!claim_evidence_document_version_id_fkey/);
    expect(materializer).toMatch(/source_documents!document_versions_source_document_id_fkey/);
    expect(materializer).toMatch(/source_connectors!source_documents_source_id_fkey/);
  });

  it('uses explicit foreign-key paths in answer and pattern evidence queries', () => {
    const answerRepository = read('src/lib/intelligence/answers/repository.ts');
    const patternDetector = read('src/lib/ingestion/pattern-detector.ts');
    expect(answerRepository).toMatch(/claim_evidence!claim_evidence_claim_id_fkey/);
    expect(patternDetector).toMatch(/claim_evidence!claim_evidence_claim_id_fkey/);
    expect(patternDetector).toMatch(/document_versions!claim_evidence_document_version_id_fkey/);
    expect(patternDetector).toMatch(/source_documents!document_versions_source_document_id_fkey/);
  });

  it('promotes source-linked legacy thesis excerpts into evidence-native claims before materialization', () => {
    const materializer = read('src/lib/intelligence/answers/thesis-materializer.ts');
    expect(materializer).toMatch(/ensureStatedThesisClaims/);
    expect(materializer).toMatch(/content_kind: 'official_thesis_excerpt'/);
    expect(materializer).toMatch(/claim_type: 'thesis_statement'/);
    expect(materializer).toMatch(/predicate: 'stated_thesis'/);
    expect(materializer).toMatch(/official-portfolio-themes-v1/);
  });

  it('extracts stable, human-meaningful thesis themes without model-generated labels', () => {
    expect(extractThesisThemes('We invest across foundation models, infrastructure, and enterprise applications.'))
      .toEqual(['foundation_models', 'infrastructure', 'applications', 'enterprise_ai']);
    expect(extractThesisThemes('We back unusually ambitious AI-first founders.')).toEqual(['ai_first_companies']);
  });

  it('turns official portfolio synchronization into claim evidence for observed intelligence', () => {
    const entitySync = read('src/lib/ingestion/entity-sync.ts');
    expect(entitySync).toMatch(/content_kind: 'official_portfolio_index'/);
    expect(entitySync).toMatch(/predicate: 'portfolio_company'/);
    expect(entitySync).toMatch(/createClaimWithEvidence/);
    expect(entitySync).toMatch(/claim\.publicationStatus !== 'published'/);
    expect(entitySync).toMatch(/content_kind: 'official_yc_ai_company_index'/);
    expect(entitySync).toMatch(/predicate: 'yc_membership'/);
  });

  it('publishes portfolio concentration patterns only with breadth and independent evidence', () => {
    const patternDetector = read('src/lib/ingestion/pattern-detector.ts');
    expect(patternDetector).toMatch(/official-portfolio-concentration-v1/);
    expect(patternDetector).toMatch(/uniqueCitations\.length >= 3 && independenceGroups\.size >= 2/);
    expect(patternDetector).toMatch(/PATTERN_INPUT_EMPTY/);
    expect(patternDetector).toMatch(/pattern_type: 'portfolio_concentration'/);
    expect(patternDetector).toMatch(/official-yc-batch-theme-concentration-v1/);
    expect(patternDetector).toMatch(/pattern_type: 'yc_batch_theme_concentration'/);
    expect(patternDetector).toMatch(/This is not a claim about funding volume or historical acceleration/);
  });

  it('uses the scheduled UTC day boundary for the default 90-day answer fingerprint', () => {
    const filters = parseAnswerFilters(new URLSearchParams(), new Date('2026-10-09T17:42:18.123Z'));
    expect(filters.periodEnd).toBe('2026-10-09T00:00:00.000Z');
    expect(filters.periodStart).toBe('2026-07-11T00:00:00.000Z');
  });

  it('makes the dashboard request the same canonical window as scheduled snapshots', () => {
    const now = new Date('2026-10-09T17:42:18.123Z');
    const query = buildDashboardAnswerQuery({ period: '90', domain: '', geography: '', stage: '' }, now);
    const filters = parseAnswerFilters(query, now);
    expect(filters.periodEnd).toBe('2026-10-09T00:00:00.000Z');
    expect(filters.periodStart).toBe('2026-07-11T00:00:00.000Z');
    expect(fingerprint(filters)).toBe('55cb124e136a5f09602bf8a7e67cf84def4d5352cf0eca574e7506ba6f6df671');
  });

  it('answers market demand in plain language and keeps direct evidence inspectable', () => {
    expect(buildMarketDemandHeadline(
      [{ key: 'applications', count: 4 }, { key: 'developer_tools', count: 3 }, { key: 'infrastructure', count: 2 }],
      [{ key: 'applications', count: 1 }, { key: 'foundation_models', count: 1 }, { key: 'robotics', count: 1 }],
      5,
    )).toBe('Across 5 official investor theses, applications (4), developer tools (3), infrastructure (2) appear most often; portfolio evidence also points to applications, foundation models, robotics.');

    const citationRoute = read('src/app/api/intelligence/citations/[id]/route.ts');
    expect(citationRoute).toMatch(/claim_evidence!answer_snapshot_citations_claim_evidence_id_fkey/);
    expect(citationRoute).toMatch(/source_documents!document_versions_source_document_id_fkey/);
    expect(citationRoute).toMatch(/rights\.excerpt_only === true/);
  });
});
