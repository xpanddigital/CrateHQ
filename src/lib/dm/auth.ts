import { createServiceClient } from '@/lib/supabase/service'

/**
 * Verify a DM Agent's webhook secret against the ig_accounts table.
 * Returns the account row if valid, null if invalid.
 */
export async function verifyAgentAuth(
  authHeader: string | null,
  igAccountId: string | null
): Promise<{ valid: true; account: any } | { valid: false; error: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or malformed Authorization header' }
  }

  if (!igAccountId) {
    return { valid: false, error: 'Missing ig_account_id' }
  }

  const token = authHeader.slice(7)
  const supabase = createServiceClient()

  const { data: account, error } = await supabase
    .from('ig_accounts')
    .select('*')
    .eq('id', igAccountId)
    .single()

  if (error || !account) {
    return { valid: false, error: 'Unknown ig_account_id' }
  }

  if (account.webhook_secret !== token) {
    return { valid: false, error: 'Invalid webhook secret' }
  }

  if (!account.is_active) {
    return { valid: false, error: 'Account is deactivated' }
  }

  return { valid: true, account }
}
