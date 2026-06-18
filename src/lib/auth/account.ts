/**
 * Account (tenant) helpers used by API routes.
 *
 * Multi-tenant model:
 *   - accounts: one per paying scout (the tenant)
 *   - account_members: many-to-many between auth users and accounts
 *   - Every data row has account_id; RLS scopes reads/writes to the caller's
 *     account_ids.
 *
 * Most routes that use the cookie-bound client (createClient()) get
 * isolation for free via RLS. Routes that use createServiceClient() (which
 * bypasses RLS) must call resolveAccountIdForUser() and filter explicitly.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Return the primary account_id for the given user. If the user owns or
 * belongs to multiple accounts, returns the first by created_at.
 *
 * Returns null if the user has no account membership (e.g. a fresh
 * admin-invited user before they've been linked to a paid scouts row).
 */
export async function resolveAccountIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('account_members')
    .select('account_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.account_id
}

/**
 * Return the account_id that owns the given IG account. Used by webhook
 * handlers (which use the service role and must scope artist matching
 * manually to avoid cross-tenant attribution).
 */
export async function resolveAccountIdForIgAccount(
  supabase: SupabaseClient,
  igAccountId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ig_accounts')
    .select('account_id')
    .eq('id', igAccountId)
    .maybeSingle()

  if (error || !data) return null
  return data.account_id
}
