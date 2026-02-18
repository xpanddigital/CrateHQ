import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client using the service role key.
 * Use this for cron jobs and background workers where there's no user session.
 * This client bypasses RLS — use with care.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false },
  })
}
