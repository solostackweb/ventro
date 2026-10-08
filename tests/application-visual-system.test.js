/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('authenticated application visual system', () => {
  const layout = read('src/app/(dashboard)/layout.tsx');
  const header = read('src/components/layout/Header.tsx');
  const styles = read('src/styles/globals.css');
  const community = read('src/app/(dashboard)/community/page.tsx');

  const standardPages = [
    'admin/page.tsx',
    'alerts/page.tsx',
    'community/page.tsx',
    'companies/page.tsx',
    'companies/[id]/page.tsx',
    'investments/page.tsx',
    'investors/page.tsx',
    'investors/[id]/page.tsx',
    'news/page.tsx',
    'news/[id]/page.tsx',
    'patterns/page.tsx',
    'patterns/[id]/page.tsx',
    'saved/page.tsx',
    'settings/page.tsx',
    'yc/page.tsx',
    'yc/[id]/page.tsx',
  ];

  test.each(standardPages)('%s uses the shared application canvas', (page) => {
    const source = read(`src/app/(dashboard)/${page}`);
    expect(source).toContain('app-page');
    expect(source).toContain('app-page-content');
  });

  test('desktop shell uses one aligned sidebar and workspace bar', () => {
    expect(layout).toContain('lg:pl-[256px]');
    expect(layout).toContain('lg:pt-[72px]');
    expect(header).toContain('app-workspace-bar');
    expect(styles).toContain('left-[256px]');
    expect(styles).toContain('w-[256px]');
  });

  test('legacy page toolbars are integrated instead of globally hidden', () => {
    expect(styles).not.toContain('header:not(.intelligence-masthead):not(.engine-masthead) { display: none; }');
    expect(styles).toContain('top: 72px !important');
  });

  test('workspace search routes into the real news query', () => {
    expect(header).toContain('/news?search=');
    expect(read('src/app/(dashboard)/news/page.tsx')).toContain("get('search')");
  });

  test('community renders real loading, empty, thread, and composer states', () => {
    expect(community).not.toContain('Community page content here');
    expect(community).toContain('New discussion');
    expect(community).toContain('Discussions unavailable');
    expect(community).toContain('threads.map');
  });
});
