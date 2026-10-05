const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// Regression: ISSUE-004 — image, excerpt label, and original link were absent from the news contract.
// Found by /qa on 2026-10-05.
// Report: AUDIT_REMEDIATION.md
describe('news presentation contract', () => {
  it('selects image and excerpt provenance in feed and detail APIs', () => {
    for (const route of ['src/app/api/feed/route.ts', 'src/app/api/stories/[id]/route.ts']) {
      const source = read(route);
      expect(source).toMatch(/image_url,/);
      expect(source).toMatch(/summary_kind,/);
    }
  });

  it('shows the feed image, labels source excerpts, and links to the original article', () => {
    const source = read('src/app/(dashboard)/news/page.tsx');
    expect(source).toMatch(/story\.image_url/);
    expect(source).toMatch(/story\.summary_kind/);
    expect(source).toMatch(/href=\{story\.canonical_url\}/);
  });
});
