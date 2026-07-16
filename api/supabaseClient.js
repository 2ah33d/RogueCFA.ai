import { createClient } from '@supabase/supabase-js';

/* ════════════════════════════════════════════════════════════════
   SUPABASE SERVER-SIDE CLIENT (`/api/`)
   Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
   Bypasses Row Level Security (RLS) safely on serverless functions.
   ════════════════════════════════════════════════════════════════ */

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. Database operations will fail.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
