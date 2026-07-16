// IMPORTANT: Replace these two placeholders with your actual Supabase project URL and anon key.
// The anon key is safe to be exposed in the frontend as security is handled via Row Level Security (RLS).
const SUPABASE_URL = 'https://jijmohgmkfgkruqmvwtp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UZ62JjEPqdBvn0OZW0ECmg_-u99zm-r';

// Create a single supabase client for interacting with your database
// This constant will be exposed globally and used by all other scripts.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
