-- Migration: Trial activation, entitlement security, and legacy migration
-- Date: 2026-10-06
-- Description: 
-- 1. Backfill legacy discount_card columns to trial_* columns
-- 2. Update entitlement check constraint to use student_trial (correct ordering: convert before constrain)
-- 3. Create atomic trial activation function with fully qualified relations
-- 4. Update has_full_access for student_trial with fully qualified relations
-- 5. Add column-level privileges: revoke table UPDATE, grant only allowed columns
-- 6. Update entitlement_audit source constraint
-- 7. Disable subscription/billing tables for payments (deferred to Phase 7)

-- ============================================
-- BACKFILL LEGACY DISCOUNT_CARD VALUES
-- ============================================

-- First, add new columns if they don't exist (safe for fresh installs)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_issued_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_eligibility_domain TEXT;

-- Backfill: migrate discount_card_expires_at -> trial_expires_at
UPDATE public.user_profiles 
SET trial_expires_at = discount_card_expires_at 
WHERE discount_card_expires_at IS NOT NULL 
  AND trial_expires_at IS NULL;

-- Backfill: migrate discount_card_issued_at -> trial_issued_at
UPDATE public.user_profiles 
SET trial_issued_at = discount_card_issued_at 
WHERE discount_card_issued_at IS NOT NULL 
  AND trial_issued_at IS NULL;

-- Backfill: set trial_eligibility_domain for legacy trials
UPDATE public.user_profiles 
SET trial_eligibility_domain = 'mastersunion.org'
WHERE trial_issued_at IS NOT NULL 
  AND trial_eligibility_domain IS NULL 
  AND entitlement = 'discount_card';

-- For legacy ACTIVE discount_card trials at migration time: ensure expiry is original_issued_at + 20 days
-- Only extend trials that are still active (trial_expires_at > NOW()) at migration time
-- Never revive expired or consumed trials
UPDATE public.user_profiles 
SET trial_expires_at = trial_issued_at + INTERVAL '20 days'
WHERE trial_issued_at IS NOT NULL 
  AND trial_expires_at IS NOT NULL
  AND entitlement = 'discount_card'
  AND trial_expires_at > NOW()  -- Only active trials at migration time
  AND trial_expires_at < trial_issued_at + INTERVAL '20 days';

-- ============================================
-- CONVERT LEGACY ENTITLEMENT VALUES BEFORE NEW CONSTRAINT
-- ============================================

-- Convert existing discount_card entitlements to student_trial
UPDATE public.user_profiles 
SET entitlement = 'student_trial'
WHERE entitlement = 'discount_card';

-- ============================================
-- UPDATE ENTITLEMENT CONSTRAINT (after conversion)
-- ============================================

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_entitlement_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_entitlement_check 
  CHECK (entitlement IN ('preview', 'student_trial', 'subscribed'));

-- ============================================
-- ADD INDEX FOR TRIAL EXPIRY QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_expires 
ON public.user_profiles(trial_expires_at) WHERE trial_expires_at IS NOT NULL;

-- ============================================
-- UPDATE ENTITLEMENT_AUDIT SOURCE CONSTRAINT
-- ============================================

ALTER TABLE public.entitlement_audit DROP CONSTRAINT IF EXISTS entitlement_audit_source_check;
ALTER TABLE public.entitlement_audit ADD CONSTRAINT entitlement_audit_source_check 
  CHECK (source IN ('razorpay_webhook', 'student_trial', 'admin', 'trial_expiry', 'manual'));

-- ============================================
-- UPDATE has_full_access FUNCTION FOR STUDENT_TRIAL (fully qualified relations)
-- ============================================

CREATE OR REPLACE FUNCTION public.has_full_access(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT entitlement, trial_expires_at INTO v_profile
  FROM public.user_profiles WHERE id = p_user_id;
  
  IF v_profile.entitlement = 'subscribed' THEN
    RETURN TRUE;
  END IF;
  
  IF v_profile.entitlement = 'student_trial' 
     AND v_profile.trial_expires_at IS NOT NULL 
     AND v_profile.trial_expires_at > NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Drop old function
DROP FUNCTION IF EXISTS public.has_discount_card_access(UUID);

-- ============================================
-- CREATE ATOMIC TRIAL ACTIVATION FUNCTION (fully qualified relations)
-- ============================================

CREATE OR REPLACE FUNCTION public.activate_student_trial()
RETURNS JSONB LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_domain TEXT;
  v_profile RECORD;
  v_result JSONB;
  v_issued_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get user email from auth.users (not user_profiles, which may be stale)
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  IF v_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_NOT_FOUND',
      'message', 'User email not found'
    );
  END IF;
  
  -- Normalize domain and check exact match
  v_domain := lower(split_part(v_email, '@', 2));
  IF v_domain <> 'mastersunion.org' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INELIGIBLE_DOMAIN',
      'message', 'Only verified @mastersunion.org emails are eligible for the student trial'
    );
  END IF;
  
  -- Check email confirmation status
  IF (SELECT email_confirmed_at FROM auth.users WHERE id = v_user_id) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_UNCONFIRMED',
      'message', 'Email must be confirmed before activating trial'
    );
  END IF;
  
  -- Lock the profile row to prevent concurrent activation
  -- First, ensure profile exists (trigger should have created it)
  -- If not found, return error rather than creating - profile creation is trigger's responsibility
  SELECT entitlement, trial_issued_at, trial_expires_at, trial_eligibility_domain
  INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Profile missing despite trigger - this indicates an auth state issue
    -- Return error rather than creating to avoid race conditions
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PROFILE_MISSING',
      'message', 'User profile not found. Please contact support.'
    );
  END IF;
  
  -- Never downgrade a subscribed user
  IF v_profile.entitlement = 'subscribed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_FULL_ACCESS',
      'message', 'User already has full subscription access',
      'entitlement', 'subscribed',
      'trial_expires_at', v_profile.trial_expires_at,
      'trial_issued_at', v_profile.trial_issued_at
    );
  END IF;
  
  -- Check if trial already consumed (trial_issued_at IS NOT NULL means consumed)
  IF v_profile.trial_issued_at IS NOT NULL THEN
    -- Check if it's an active trial (not expired)
    IF v_profile.trial_expires_at IS NOT NULL AND v_profile.trial_expires_at > NOW() THEN
      RETURN jsonb_build_object(
        'success', true,
        'code', 'TRIAL_ACTIVE',
        'message', 'Trial already active',
        'entitlement', 'student_trial',
        'trial_expires_at', v_profile.trial_expires_at,
        'trial_issued_at', v_profile.trial_issued_at
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'code', 'TRIAL_CONSUMED',
        'message', 'Trial already consumed and expired; cannot be reissued'
      );
    END IF;
  END IF;
  
  -- Check if currently on student_trial (defense in depth)
  IF v_profile.entitlement = 'student_trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIAL_ALREADY_ACTIVE',
      'message', 'Trial already active'
    );
  END IF;
  
  -- Activate trial: exactly 20 days from transaction time in UTC
  v_issued_at := NOW();
  v_expires_at := NOW() + INTERVAL '20 days';
  
  UPDATE public.user_profiles
  SET entitlement = 'student_trial',
      trial_issued_at = v_issued_at,
      trial_expires_at = v_expires_at,
      trial_eligibility_domain = 'mastersunion.org',
      updated_at = v_issued_at
  WHERE id = v_user_id;
  
  -- Insert audit event in same transaction
  INSERT INTO public.entitlement_audit (user_id, previous_entitlement, new_entitlement, source, metadata)
  VALUES (v_user_id, v_profile.entitlement, 'student_trial', 'student_trial', 
          jsonb_build_object('trial_expires_at', v_expires_at, 'trial_issued_at', v_issued_at));
  
  v_result := jsonb_build_object(
    'success', true,
    'code', 'TRIAL_ACTIVATED',
    'message', '20-day student trial activated',
    'entitlement', 'student_trial',
    'trial_expires_at', v_expires_at,
    'trial_issued_at', v_issued_at
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.activate_student_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_student_trial() TO authenticated;

-- ============================================
-- COLUMN-LEVEL PRIVILEGES: REVOKE TABLE UPDATE, GRANT ONLY ALLOWED COLUMNS
-- ============================================

-- Revoke table-level UPDATE from authenticated (Supabase commonly grants this)
REVOKE UPDATE ON public.user_profiles FROM authenticated;

-- Grant UPDATE only on explicitly allowed profile columns
GRANT UPDATE (role, ai_topics, geographies, stages, onboarding_completed_at) 
ON public.user_profiles TO authenticated;

-- Keep the own-row RLS policy as a second boundary
-- (RLS policy "Users can update own profile (non-sensitive)" already exists from prior migration)

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.user_profiles.trial_expires_at IS 'Expiry timestamp for student trial (20 days from issuance)';
COMMENT ON COLUMN public.user_profiles.trial_issued_at IS 'Timestamp when student trial was granted (immutable after set)';
COMMENT ON COLUMN public.user_profiles.trial_eligibility_domain IS 'Email domain that qualified user for trial (e.g., mastersunion.org)';
COMMENT ON FUNCTION public.activate_student_trial() IS 'Atomic trial activation: verifies eligibility, prevents reissue, sets entitlement and audit in one transaction';
COMMENT ON FUNCTION public.has_full_access(UUID) IS 'Centralized expiry-aware access check: returns true only for active subscribed or non-expired student_trial';