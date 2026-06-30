import { createClient } from '@supabase/supabase-js'

// Hexa Space RND — uses its OWN Supabase project (set these in .env.local / Vercel).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
