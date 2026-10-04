const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadNormalizer() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/utils/normalize-story.ts'),
    'utf8'
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function('exports', 'module', output)(compiledModule.exports, compiledModule);
  return compiledModule.exports.normalizeStory;
}

describe('story response contract', () => {
  it('provides empty entity and topic arrays when a story has no associations', () => {
    const normalizeStory = loadNormalizer();
    expect(normalizeStory({ id: 'story-1', ai_topics: null })).toEqual(expect.objectContaining({
      id: 'story-1',
      companies: [],
      investors: [],
      ai_topics: [],
    }));
  });

  it('maps linked entities and preserves source timeline rows', () => {
    const normalizeStory = loadNormalizer();
    expect(normalizeStory({
      id: 'story-2',
      story_companies: [{ company_id: 'company-1', role: 'primary', companies: { canonical_name: 'Acme' } }],
      story_investors: [{ fund_id: 'fund-1', role: 'lead', funds: { canonical_name: 'Fund A' } }],
      story_sources: [{ source_url: 'https://example.com/story' }],
    })).toEqual(expect.objectContaining({
      companies: [{ company_id: 'company-1', role: 'primary', name: 'Acme' }],
      investors: [{ fund_id: 'fund-1', role: 'lead', name: 'Fund A' }],
      story_sources: [{ source_url: 'https://example.com/story' }],
    }));
  });

  it('uses the same normalizer for feed and detail responses', () => {
    const feed = fs.readFileSync(path.resolve(__dirname, '../src/app/api/feed/route.ts'), 'utf8');
    const detail = fs.readFileSync(path.resolve(__dirname, '../src/app/api/stories/[id]/route.ts'), 'utf8');
    expect(feed).toMatch(/normalizeStory\(s\)/);
    expect(detail).toMatch(/normalizeStory\(story\)/);
  });
});
