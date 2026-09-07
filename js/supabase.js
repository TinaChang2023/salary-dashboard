// =========================================================
// Supabase client initialization
// -----------------------------------------------------------
// SECURITY: only the URL + anon/public key belong here.
// NEVER put the Service Role Key in this file (or anywhere in
// the frontend / this repository) — the anon key is safe to
// expose publicly because all data access is enforced by
// PostgreSQL Row Level Security policies on the server side.
// =========================================================

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
