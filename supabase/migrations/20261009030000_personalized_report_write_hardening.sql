-- Report lifecycle fields are server-managed. Authenticated users may create and read
-- their own report rows, while only the service role may update generated artifacts.

DROP POLICY IF EXISTS "Users can update own personalized reports" ON public.personalized_reports;
DROP POLICY IF EXISTS "Users can delete own personalized reports" ON public.personalized_reports;

REVOKE UPDATE, DELETE ON public.personalized_reports FROM authenticated;
GRANT SELECT, INSERT ON public.personalized_reports TO authenticated;
