import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE = import.meta.env.VITE_SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase env vars (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)')
}

// Anon client - for public read access (face_embeddings if RLS allows)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// Admin client - bypasses RLS. Used for writes from the kiosk.
// SECURITY NOTE: This key is exposed in the bundle. Must be rotated for production
// and replaced with proper RLS policies or an Edge Function proxy in Phase 5 hardening.
export const supabaseAdmin = SUPABASE_SERVICE_ROLE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    })
  : null

if (!supabaseAdmin) {
  console.warn('VITE_SUPABASE_SERVICE_ROLE not set — kiosk will not be able to write attendance')
}
