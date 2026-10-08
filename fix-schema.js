/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const schema = fs.readFileSync('supabase/schema.sql', 'utf8');
const lines = schema.split('\n');

// Line 873 has the old comment with the pipeline marker appended. We need to keep only up to the semicolon
lines[873] = "COMMENT ON FUNCTION public.has_full_access() IS 'Centralized expiry-aware access check: returns true only for active subscribed or non-expired student_trial';";

// Rebuild
const newSchema = lines.join('\n');
fs.writeFileSync('supabase/schema.sql', newSchema);
console.log('Fixed duplicate line');
