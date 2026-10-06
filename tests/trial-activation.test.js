const fs = require('fs');
const path = require('path');

describe('trial activation security contracts', () => {
  const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

  it('has atomic trial activation RPC function in baseline migration', () => {
    const migration = read('supabase/migrations/20261006010000_initial_ventro_schema.sql');
    
    // Function exists and is SECURITY DEFINER
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.activate_student_trial\(\)/);
    expect(migration).toMatch(/SECURITY DEFINER SET search_path = ''/);
    
    // Returns JSONB
    expect(migration).toMatch(/RETURNS JSONB/);
    
    // Checks email confirmation
    expect(migration).toMatch(/email_confirmed_at/);
    expect(migration).toMatch(/EMAIL_UNCONFIRMED/);
    
    // Checks exact domain match (case-insensitive)
    expect(migration).toMatch(/v_domain := lower\(split_part\(v_email, '@', 2\)\)/);
    expect(migration).toMatch(/v_domain <> 'mastersunion.org'/);
    expect(migration).toMatch(/INELIGIBLE_DOMAIN/);
    
    // Prevents reissue: checks trial_issued_at IS NOT NULL
    expect(migration).toMatch(/trial_issued_at IS NOT NULL/);
    expect(migration).toMatch(/TRIAL_CONSUMED/);
    
    // Uses FOR UPDATE lock for concurrency
    expect(migration).toMatch(/FOR UPDATE/);
    
    // Sets 20-day expiry from NOW()
    expect(migration).toMatch(/NOW\(\) \+ INTERVAL '20 days'/);
    
    // Inserts audit event in same transaction
    expect(migration).toMatch(/INSERT INTO public\.entitlement_audit/);
    expect(migration).toMatch(/source.*student_trial/);
    
    // Grants execute to authenticated only
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.activate_student_trial\(\) TO authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.activate_student_trial\(\) FROM PUBLIC/);
  });

  it('has correct entitlement constraint (no discount_card)', () => {
    const migration = read('supabase/migrations/20261006010000_initial_ventro_schema.sql');
    
    // Entitlement constraint only has preview, student_trial, subscribed
    expect(migration).toMatch(/CHECK \(entitlement IN \('preview', 'student_trial', 'subscribed'\)\)/);
    
    // No discount_card column references in baseline (only in comments about what was removed)
    const codeLines = migration.split('\n').filter(line => !line.trim().startsWith('--'));
    const code = codeLines.join('\n');
    expect(code).not.toMatch(/discount_card/);
  });

  it('protects sensitive columns via RLS and GRANT', () => {
    const migration = read('supabase/migrations/20261006010000_initial_ventro_schema.sql');
    
    // Revokes UPDATE on sensitive columns
    expect(migration).toMatch(/REVOKE UPDATE ON public\.user_profiles FROM authenticated/);
    
    // Grants UPDATE on allowed columns only (with possible line breaks)
    expect(migration).toMatch(/GRANT UPDATE \(role, ai_topics, geographies, stages, onboarding_completed_at\)[\s\S]*?ON public\.user_profiles TO authenticated/);
  });

  it('has parameterless has_full_access deriving from auth.uid()', () => {
    const migration = read('supabase/migrations/20261006010000_initial_ventro_schema.sql');
    
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.has_full_access\(\)/);
    expect(migration).toMatch(/v_user_id UUID := auth\.uid\(\)/);
    expect(migration).toMatch(/v_profile\.entitlement = 'student_trial'[\s\S]*?AND v_profile\.trial_expires_at IS NOT NULL[\s\S]*?AND v_profile\.trial_expires_at > NOW\(\)/);
  });

  it('updates entitlement_audit source constraint', () => {
    const migration = read('supabase/migrations/20261006010000_initial_ventro_schema.sql');
    
    expect(migration).toMatch(/entitlement_audit_source_check/);
    expect(migration).toMatch(/CHECK \(source IN \('razorpay_webhook', 'student_trial', 'admin', 'trial_expiry', 'manual'\)\)/);
  });
});

describe('checkout endpoint is fail-closed', () => {
  const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

  it('returns 503 PAYMENTS_DISABLED without provider calls', () => {
    const checkout = read('src/app/api/checkout/route.ts');
    
    expect(checkout).toMatch(/PAYMENTS_DISABLED/);
    expect(checkout).toMatch(/503/);
    expect(checkout).not.toMatch(/RAZORPAY_KEY/);
    expect(checkout).not.toMatch(/fetch\(['"]https:\/\/api\.razorpay/);
    expect(checkout).not.toMatch(/\.from\('subscriptions'/);
    expect(checkout).not.toMatch(/\.from\('billing_events'/);
    expect(checkout).not.toMatch(/\.from\('user_profiles'\)[\s\S]*?\.update\(/);
  });
});

describe('razorpay webhook endpoint is fail-closed', () => {
  const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

  it('returns 503 PAYMENTS_DISABLED without event processing', () => {
    const webhook = read('src/app/api/webhooks/razorpay/route.ts');
    
    expect(webhook).toMatch(/PAYMENTS_DISABLED/);
    expect(webhook).toMatch(/503/);
    expect(webhook).not.toMatch(/RAZORPAY_WEBHOOK_SECRET/);
    expect(webhook).not.toMatch(/crypto\.createHmac/);
    expect(webhook).not.toMatch(/event\.event/);
    expect(webhook).not.toMatch(/handlePaymentCaptured/);
    expect(webhook).not.toMatch(/\.from\('subscriptions'/);
    expect(webhook).not.toMatch(/\.from\('billing_events'/);
  });
});

describe('trial activation endpoint uses atomic RPC', () => {
  const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

  it('calls activate_student_trial RPC', () => {
    const trialRoute = read('src/app/api/trial/activate/route.ts');
    
    expect(trialRoute).toMatch(/supabase\.rpc\('activate_student_trial'/);
    expect(trialRoute).not.toMatch(/RAZORPAY/);
    expect(trialRoute).not.toMatch(/fetch\(['"]https:\/\/api\.razorpay/);
    expect(trialRoute).not.toMatch(/\.from\('subscriptions'/);
    expect(trialRoute).not.toMatch(/\.from\('billing_events'/);
  });

  it('maps error codes to HTTP status', () => {
    const trialRoute = read('src/app/api/trial/activate/route.ts');
    
    expect(trialRoute).toMatch(/EMAIL_NOT_FOUND.*400/);
    expect(trialRoute).toMatch(/INELIGIBLE_DOMAIN.*403/);
    expect(trialRoute).toMatch(/EMAIL_UNCONFIRMED.*403/);
    expect(trialRoute).toMatch(/TRIAL_CONSUMED.*409/);
    expect(trialRoute).toMatch(/TRIAL_ALREADY_ACTIVE.*409/);
  });
});

describe('UI uses trial endpoint not checkout', () => {
  const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

  it('pricing page calls /api/trial/activate for trial', () => {
    const pricing = read('src/app/pricing/page.tsx');
    
    expect(pricing).toMatch(/\/api\/trial\/activate/);
    expect(pricing).not.toMatch(/\/api\/checkout/);
    expect(pricing).not.toMatch(/checkout\.razorpay/);
  });

  it('no 10-day trial copy remains in UI', () => {
    const pricing = read('src/app/pricing/page.tsx');
    const signup = read('src/app/(auth)/signup/page.tsx');
    const landing = read('src/app/(public)/page.tsx');
    const settings = read('src/app/(dashboard)/settings/page.tsx');
    
    // Check for 10-day references
    expect(pricing).not.toMatch(/10.day/);
    expect(signup).not.toMatch(/10.day/);
    expect(landing).not.toMatch(/10.day/);
    expect(settings).not.toMatch(/10.day/);
    
    // Check for discount_card terminology
    expect(pricing).not.toMatch(/discount_card/);
    expect(signup).not.toMatch(/discount_card/);
    expect(landing).not.toMatch(/discount_card/);
    expect(settings).not.toMatch(/discount_card/);
  });
});

describe('migration version prefixes are unique', () => {
  const fs = require('fs');
  const path = require('path');

  it('no duplicate migration timestamps', () => {
    const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    
    const prefixes = files.map(f => f.slice(0, 14)); // YYYYMMDDHHMMSS
    const uniquePrefixes = new Set(prefixes);
    
    expect(prefixes.length).toBe(uniquePrefixes.size);
  });
});

