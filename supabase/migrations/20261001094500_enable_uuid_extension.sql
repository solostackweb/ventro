-- Enable uuid-ossp extension for uuid_generate_v4()
-- This must be run before any migration that uses uuid_generate_v4()

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Also create the exec_sql helper function
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;