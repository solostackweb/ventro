-- Migration: Fix auto-activate student trial on signup
-- Date: 2026-10-10
-- Description: Simplify handle_new_user trigger to properly auto-activate trial

-- Drop and recreate the function with corrected logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;

  -- Create workspace settings
  INSERT INTO public.workspace_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-activate trial for @mastersunion.org if email is already confirmed
  IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    IF lower(split_part(NEW.email, '@', 2)) = 'mastersunion.org' THEN
      -- Update profile to activate trial, only if still on preview and never issued
      UPDATE public.user_profiles
      SET entitlement = 'student_trial',
          trial_issued_at = NOW(),
          trial_expires_at = NOW() + INTERVAL '20 days',
          trial_eligibility_domain = 'mastersunion.org',
          updated_at = NOW()
      WHERE id = NEW.id
        AND entitlement = 'preview'
        AND trial_issued_at IS NULL;
      
      -- Check if update happened using GET DIAGNOSTICS
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      
      IF v_updated THEN
        INSERT INTO public.entitlement_audit (user_id, previous_entitlement, new_entitlement, source, metadata)
        VALUES (NEW.id, 'preview', 'student_trial', 'student_trial', 
                jsonb_build_object('auto_activated', true, 'email_confirmed_at', NEW.email_confirmed_at));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger already exists from base migration, no need to recreate