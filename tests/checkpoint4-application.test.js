/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Checkpoint 4 evidence-first application contracts', () => {
  const dashboard = read('src/components/intelligence/IntelligenceDashboard.tsx');
  const header = read('src/components/layout/Header.tsx');
  const settings = read('src/app/(dashboard)/settings/page.tsx');
  const landing = read('src/app/(public)/page.tsx');
  const thesis = read('src/app/(dashboard)/theses/page.tsx');
  const citationRoute = read('src/app/api/intelligence/citations/[id]/route.ts');
  const accountDelete = read('src/app/api/account/delete/route.ts');
  const answerRepository = read('src/lib/intelligence/answers/repository.ts');
  const answerRequestQuery = read('src/lib/intelligence/answers/request-query.ts');

  test('the two product questions dominate the dashboard', () => {
    expect(dashboard).toContain('What are investors investing in now?');
    expect(dashboard).toContain('What are they looking for from the market?');
  });

  test('dashboard reads the Checkpoint 3 answer API and preserves filters in the URL', () => {
    expect(dashboard).toContain('/api/intelligence/answers?');
    expect(dashboard).toContain('router.replace(`${pathname}?${query.toString()}`');
    expect(dashboard).toContain('buildDashboardAnswerQuery(filters)');
    expect(answerRequestQuery).toContain("query.set('domains', filters.domain)");
  });

  test('disclosed and undisclosed investment semantics are explicit', () => {
    expect(dashboard).toContain('Disclosed capital');
    expect(dashboard).toContain('not counted as $0');
    expect(dashboard).toContain('Disclosed totals exclude unknown amounts');
  });

  test('stated and observed thesis are visually and semantically separate', () => {
    expect(thesis).toContain('Stated thesis');
    expect(thesis).toContain('Observed thesis');
    expect(thesis).toContain('Attributable');
    expect(thesis).toContain('Inference');
  });

  test('snapshot citation IDs survive the repository boundary for one-click evidence', () => {
    expect(answerRepository).toMatch(/id:\s*citation\.id/);
    expect(dashboard).toContain('/api/intelligence/citations/${citation.id}');
    expect(citationRoute).toContain('excerptRestricted');
  });

  test('preview depth and the 20-day student trial are explained without payment activation', () => {
    expect(dashboard).toContain('20-day student trial');
    expect(settings).toContain('Payments, checkout, invoices, and provider webhooks are disabled');
    expect(settings).toContain('Coming Soon');
  });

  test('major dashboard states are intentional', () => {
    expect(dashboard).toContain('animate-pulse');
    expect(dashboard).toContain('Intelligence brief unavailable');
    expect(dashboard).toContain('Evidence is still accumulating');
    expect(dashboard).toContain('Stale snapshot');
    expect(dashboard).toContain('Counter-evidence');
  });

  test('mobile navigation exposes the primary research engines', () => {
    expect(header).toContain('mobile-bottom-nav');
    expect(header).toContain("label: 'Investments'");
    expect(header).toContain("label: 'YC Engine'");
    expect(header).toContain("label: 'Theses'");
  });

  test('security and destructive account controls require explicit confirmation', () => {
    expect(settings).toContain('Sign out everywhere');
    expect(settings).toContain("deleteConfirmation !== 'DELETE MY ACCOUNT'");
    expect(accountDelete).toContain("body.confirmation !== 'DELETE MY ACCOUNT'");
    expect(accountDelete).toContain('auth.admin.deleteUser(user.id)');
  });

  test('public landing uses product truth rather than fabricated deal examples', () => {
    expect(landing).toContain('Payments are not enabled');
    expect(landing).toContain('Unknown stays unknown');
    expect(landing).not.toContain('$6.6B');
    expect(landing).not.toContain('OpenAI');
  });
});
