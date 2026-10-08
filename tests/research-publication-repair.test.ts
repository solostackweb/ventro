import { readFileSync } from 'fs';
import { resolve } from 'path';
import { feedFilterSchema } from '@/lib/validators/schemas';

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
});
