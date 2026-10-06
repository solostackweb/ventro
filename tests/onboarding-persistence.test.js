const fs = require('fs');
const path = require('path');

describe('onboarding persistence contracts', () => {
  const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

  it('creates and backfills profiles for Supabase Auth users', () => {
    const migration = read('supabase/migrations/20261006010000_initial_ventro_schema.sql');

    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/);
    expect(migration).toMatch(/CREATE TRIGGER on_auth_user_created/);
    expect(migration).toMatch(/AFTER INSERT ON auth\.users/);
    expect(migration).toMatch(/INSERT INTO public\.user_profiles \(id, email\)/);
    expect(migration).toMatch(/FROM auth\.users/);
  });

  it('submits onboarding through the verified server endpoint', () => {
    const page = read('src/app/(auth)/onboarding/page.tsx');

    expect(page).toMatch(/fetch\('\/api\/onboarding'/);
    expect(page).not.toMatch(/\.from\('user_profiles'\)/);
    expect(page).toMatch(/if \(!response\.ok\)/);
  });

  it('repairs missing profiles and verifies completion before reporting success', () => {
    const route = read('src/app/api/onboarding/route.ts');

    expect(route).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(route).toMatch(/\.from\('user_profiles'\)[\s\S]*?\.upsert\(/);
    expect(route).toMatch(/\.select\('id, onboarding_completed_at'\)[\s\S]*?\.single\(\)/);
    expect(route).toMatch(/!completedProfile\?\.onboarding_completed_at/);
  });
});
