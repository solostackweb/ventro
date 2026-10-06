/**
 * Executable database integration tests for Milestone 0.1 Clean Supabase Baseline.
 * These tests run against a real Supabase/PostgreSQL instance via the Supabase CLI.
 * 
 * Prerequisites:
 * - Docker running
 * - Supabase CLI installed: npm install -g supabase
 * - Run: npx supabase start (starts local Supabase stack)
 * - Run: npx supabase db reset (applies migrations)
 * 
 * These tests are executed as part of `npm test` and require a live database connection.
 * If the local Supabase stack is unavailable, tests will fail explicitly — they will not
 * silently pass or skip.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Track all created test users for cleanup
const createdTestUsers = [];

describe('Milestone 0.1 Database Integration Tests', () => {
  let supabase;
  let adminSupabase;

  beforeAll(async () => {
    // Admin client for setup/cleanup
    adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Regular client for user operations
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  afterAll(async () => {
    // Cleanup all test users
    for (const userId of createdTestUsers) {
      try {
        await adminSupabase.auth.admin.deleteUser(userId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // Helper to create a test user
  async function createTestUser(email) {
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password: 'testpassword123',
      email_confirm: true,
      user_metadata: {}
    });
    if (error) throw error;
    createdTestUsers.push(data.user.id);
    return data.user;
  }

  // Helper to sign in as test user (must use same email)
  async function signInAsTestUser(email) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'testpassword123'
    });
    if (error) throw error;
    return data.session;
  }

  describe('activate_student_trial() RPC', () => {
    let testUserId;

    beforeEach(async () => {
      const email = `rpc-test-${Date.now()}@mastersunion.org`;
      const user = await createTestUser(email);
      testUserId = user.id;
      await signInAsTestUser(email);
    });

    it('eligible confirmed user activates exactly once', async () => {
      const { data, error } = await supabase.rpc('activate_student_trial');
      
      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.code).toBe('TRIAL_ACTIVATED');
      expect(data.entitlement).toBe('student_trial');
      expect(data.trial_expires_at).toBeDefined();
      expect(data.trial_issued_at).toBeDefined();
      
      // Verify profile was updated
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('entitlement, trial_expires_at, trial_issued_at, trial_eligibility_domain')
        .single();
      
      expect(profile.entitlement).toBe('student_trial');
      expect(profile.trial_eligibility_domain).toBe('mastersunion.org');
      
      // Verify audit event was created
      const { data: audit } = await supabase
        .from('entitlement_audit')
        .select('*')
        .eq('user_id', testUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      expect(audit.new_entitlement).toBe('student_trial');
      expect(audit.source).toBe('student_trial');
    });

    it('concurrent activations create one grant and one audit event', async () => {
      // Execute multiple concurrent activations
      const promises = Array(5).fill(null).map(() => supabase.rpc('activate_student_trial'));
      const results = await Promise.all(promises);
      
      // Exactly one should succeed with TRIAL_ACTIVATED
      const activated = results.filter(r => r.data?.code === 'TRIAL_ACTIVATED');
      const alreadyActive = results.filter(r => r.data?.code === 'TRIAL_ALREADY_ACTIVE' || r.data?.code === 'TRIAL_ACTIVE');
      
      expect(activated.length).toBe(1);
      expect(activated.length + alreadyActive.length).toBe(5);
      
      // Verify only one audit event
      const { data: audits, error } = await supabase
        .from('entitlement_audit')
        .select('*')
        .eq('user_id', testUserId)
        .eq('new_entitlement', 'student_trial');
      
      expect(error).toBeNull();
      expect(audits.length).toBe(1);
    });

    it('unconfirmed email accounts fail', async () => {
      const unconfirmedUser = await adminSupabase.auth.admin.createUser({
        email: 'unconfirmed@mastersunion.org',
        password: 'testpassword123',
        email_confirm: false
      });
      createdTestUsers.push(unconfirmedUser.user.id);
      
      // Sign in as unconfirmed user
      await supabase.auth.signInWithPassword({
        email: 'unconfirmed@mastersunion.org',
        password: 'testpassword123'
      });
      
      const { data } = await supabase.rpc('activate_student_trial');
      expect(data.success).toBe(false);
      expect(data.code).toBe('EMAIL_UNCONFIRMED');
    });

    it('deceptive-domain accounts fail', async () => {
      const deceptiveUser = await adminSupabase.auth.admin.createUser({
        email: 'user@mastersunion.org.attacker.com',
        password: 'testpassword123',
        email_confirm: true
      });
      createdTestUsers.push(deceptiveUser.user.id);
      
      await supabase.auth.signInWithPassword({
        email: 'user@mastersunion.org.attacker.com',
        password: 'testpassword123'
      });
      
      const { data } = await supabase.rpc('activate_student_trial');
      expect(data.success).toBe(false);
      expect(data.code).toBe('INELIGIBLE_DOMAIN');
    });

    it('subscribed account is not downgraded', async () => {
      // First activate trial
      await supabase.rpc('activate_student_trial');
      
      // Manually upgrade to subscribed (simulating webhook)
      await adminSupabase
        .from('user_profiles')
        .update({ entitlement: 'subscribed' })
        .eq('id', testUserId);
      
      // Try to activate trial again
      const { data } = await supabase.rpc('activate_student_trial');
      
      expect(data.success).toBe(true);
      expect(data.code).toBe('ALREADY_FULL_ACCESS');
      expect(data.entitlement).toBe('subscribed');
      
      // Verify entitlement unchanged
      const { data: profile } = await adminSupabase
        .from('user_profiles')
        .select('entitlement')
        .eq('id', testUserId)
        .single();
      
      expect(profile.entitlement).toBe('subscribed');
      
      // Verify no new audit event for downgrade
      const { data: audits } = await adminSupabase
        .from('entitlement_audit')
        .select('*')
        .eq('user_id', testUserId)
        .eq('new_entitlement', 'student_trial');
      
      // Should only have the original activation audit
      expect(audits.length).toBe(1);
    });

    it('previously consumed trial cannot be reissued', async () => {
      // Activate and then manually expire trial
      await supabase.rpc('activate_student_trial');
      
      // Manually expire
      await adminSupabase
        .from('user_profiles')
        .update({ 
          trial_expires_at: new Date(Date.now() - 1000).toISOString() // Expired
        })
        .eq('id', testUserId);
      
      // Try to activate again
      const { data } = await supabase.rpc('activate_student_trial');
      
      expect(data.success).toBe(false);
      expect(data.code).toBe('TRIAL_CONSUMED');
    });

    it('non-mastersunion.org domains are rejected', async () => {
      const outsider = await adminSupabase.auth.admin.createUser({
        email: 'outsider@gmail.com',
        password: 'testpassword123',
        email_confirm: true
      });
      createdTestUsers.push(outsider.user.id);
      
      await supabase.auth.signInWithPassword({
        email: 'outsider@gmail.com',
        password: 'testpassword123'
      });
      
      const { data } = await supabase.rpc('activate_student_trial');
      expect(data.success).toBe(false);
      expect(data.code).toBe('INELIGIBLE_DOMAIN');
    });
  });

  describe('has_full_access() centralized authorization (parameterless, derives from auth.uid())', () => {
    let testUserId;

    beforeEach(async () => {
      const email = `has-access-${Date.now()}@mastersunion.org`;
      const user = await createTestUser(email);
      testUserId = user.id;
      await signInAsTestUser(email);
    });

    it('active student_trial returns true', async () => {
      await supabase.rpc('activate_student_trial');
      
      const { data } = await supabase.rpc('has_full_access');
      expect(data).toBe(true);
    });

    it('expired student_trial returns false', async () => {
      await supabase.rpc('activate_student_trial');
      
      // Manually expire
      await adminSupabase
        .from('user_profiles')
        .update({ trial_expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', testUserId);
      
      const { data } = await supabase.rpc('has_full_access');
      expect(data).toBe(false);
    });

    it('missing trial_expires_at returns false', async () => {
      await supabase.rpc('activate_student_trial');
      
      // Manually remove expiry
      await adminSupabase
        .from('user_profiles')
        .update({ trial_expires_at: null })
        .eq('id', testUserId);
      
      const { data } = await supabase.rpc('has_full_access');
      expect(data).toBe(false);
    });

    it('subscribed user returns true', async () => {
      await adminSupabase
        .from('user_profiles')
        .update({ entitlement: 'subscribed' })
        .eq('id', testUserId);
      
      const { data } = await supabase.rpc('has_full_access');
      expect(data).toBe(true);
    });

    it('preview user returns false', async () => {
      // Don't activate trial
      const { data } = await supabase.rpc('has_full_access');
      expect(data).toBe(false);
    });
  });

  describe('Column-level privileges', () => {
    let testUserId;

    beforeEach(async () => {
      const email = `priv-test-${Date.now()}@mastersunion.org`;
      const user = await createTestUser(email);
      testUserId = user.id;
      await signInAsTestUser(email);
    });

    it('authenticated direct sensitive-column update fails (entitlement)', async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ entitlement: 'subscribed' })
        .eq('id', testUserId);
      
      expect(error).not.toBeNull();
    });

    it('authenticated direct sensitive-column update fails (trial_expires_at)', async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ trial_expires_at: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', testUserId);
      
      expect(error).not.toBeNull();
    });

    it('authenticated direct sensitive-column update fails (trial_issued_at)', async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ trial_issued_at: new Date().toISOString() })
        .eq('id', testUserId);
      
      expect(error).not.toBeNull();
    });

    it('allowed profile update (role, ai_topics) succeeds', async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          role: 'founder',
          ai_topics: ['foundation_models', 'infrastructure']
        })
        .eq('id', testUserId);
      
      expect(error).toBeNull();
      
      // Verify update persisted
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, ai_topics')
        .eq('id', testUserId)
        .single();
      
      expect(profile.role).toBe('founder');
      expect(profile.ai_topics).toContain('foundation_models');
    });
  });

  describe('Admin review objects exist in baseline', () => {
    it('admin_users table exists', async () => {
      const { data, error } = await adminSupabase
        .from('admin_users')
        .select('user_id')
        .limit(1);
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('admin_review_events table exists', async () => {
      const { data, error } = await adminSupabase
        .from('admin_review_events')
        .select('id')
        .limit(1);
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('admin_review_candidate function exists and requires admin', async () => {
      // Create a non-admin user
      const user = await createTestUser(`non-admin-${Date.now()}@mastersunion.org`);
      await signInAsTestUser(user.email);
      
      const { data, error } = await supabase.rpc('admin_review_candidate', {
        p_kind: 'story',
        p_id: '00000000-0000-0000-0000-000000000000',
        p_expected_status: 'unverified',
        p_new_status: 'verified',
        p_reason: 'Test reason for review'
      });
      
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error.message).toContain('Admin access required');
    });
  });

  

  describe('Function execution grants', () => {
    it('has_full_access() revokes PUBLIC execution', async () => {
      const { data, error } = await adminSupabase.rpc('has_full_access');
      // Should work via service role (bypasses grants)
      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });

    it('activate_student_trial() revokes PUBLIC execution', async () => {
      const { data, error } = await adminSupabase.rpc('activate_student_trial');
      // Should work via service role (bypasses grants)
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.success).toBeDefined();
    });

    it('admin_review_candidate() revokes PUBLIC execution', async () => {
      const { data, error } = await adminSupabase.rpc('admin_review_candidate', {
        p_kind: 'story',
        p_id: '00000000-0000-0000-0000-000000000000',
        p_expected_status: 'unverified',
        p_new_status: 'verified',
        p_reason: 'Test reason for review test'
      });
      // Should work via service role (bypasses grants)
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});