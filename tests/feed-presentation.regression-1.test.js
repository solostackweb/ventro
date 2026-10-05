const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadPresentation() {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ingestion/feed-presentation.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', compiled)(mod.exports, mod);
  return mod.exports;
}

// Regression: ISSUE-004 — feeds discarded available image and readable excerpt metadata.
// Found by /qa on 2026-10-05.
// Report: AUDIT_REMEDIATION.md
describe('feed presentation metadata', () => {
  it('keeps a feed-provided image and readable source excerpt', () => {
    const { presentFeedItem } = loadPresentation();
    expect(presentFeedItem({
      enclosure: { url: 'https://publisher.example/cover.jpg', type: 'image/jpeg' },
      contentSnippet: 'First sentence about the round. Second sentence explains the product.',
    }, 'summary_only')).toEqual({
      imageUrl: 'https://publisher.example/cover.jpg',
      excerpt: 'First sentence about the round. Second sentence explains the product.',
    });
  });

  it('does not display a video enclosure or unsafe image URL', () => {
    const { presentFeedItem } = loadPresentation();
    expect(presentFeedItem({
      enclosure: { url: 'https://publisher.example/video.mp4', type: 'video/mp4' },
      'media:thumbnail': { $: { url: 'javascript:alert(1)' } },
    }, 'summary_only').imageUrl).toBeNull();
  });

  it('does not reuse article text when the connector permits links only', () => {
    const { presentFeedItem } = loadPresentation();
    expect(presentFeedItem({ contentSnippet: 'A restricted article excerpt.' }, 'link_only').excerpt).toBe('');
  });
});
