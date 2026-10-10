-- Migration: Auto-activate student trial on signup for @mastersunion.org
-- Date: 2026-10-10
-- Description: Modifies handle_new_user trigger to auto-activate trial for eligible emails

-- Update handle_new_user to auto-activate trial for @mastersunion.org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trial_result JSONB;
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
  -- Google OAuth emails are pre-confirmed, so this works for Google signups
  IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    IF lower(split_part(NEW.email, '@', 2)) = 'mastersunion.org' THEN
      -- Call activate_student_trial logic inline to avoid permission issues
      -- We replicate the core logic here since we can't call RPC from trigger easily
      UPDATE public.user_profiles
      SET entitlement = 'student_trial',
          trial_issued_at = NOW(),
          trial_expires_at = NOW() + INTERVAL '20 days',
          trial_eligibility_domain = 'mastersunion.org',
          updated_at = NOW()
      WHERE id = NEW.id
        AND entitlement = 'preview'  -- Only if still on preview
        AND trial_issued_at IS NULL; -- Only if never issued before
      
      -- If trial was activated, create audit record
      IF FOUND THEN
        INSERT INTO public.entitlement_audit (user_id, previous_entitlement, new_entitlement, source, metadata)
        VALUES (NEW.id, 'preview', 'student_trial', 'student_trial', 
                jsonb_build_object('auto_activated', true, 'email_confirmed_at', NEW.email_confirmed_at));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Note: The existing trigger on auth.users already exists, no need to recreate