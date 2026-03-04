/**
 * Go High Level (GHL) API — per-account client.
 *
 * All publishing, scheduling, and calendar GHL calls use the location API key
 * stored in ig_accounts.ghl_api_key for that account. The agency-level
 * GHL_API_KEY in env is only for future agency endpoints (e.g. listing/creating
 * sub-accounts).
 */

const GHL_VERSION = '2021-07-28'
const DEFAULT_BASE = 'https://services.leadconnectorhq.com'

export type GHLClientConfig = {
  apiKey: string
  locationId: string
  socialAccountId: string
  baseUrl: string
  version: string
}

export type GHLClient = {
  config: GHLClientConfig
  /** Authorization header value */
  authHeader: string
  /** Version header value */
  versionHeader: string
  /** Base URL for API requests (no trailing slash) */
  baseUrl: string
}

/**
 * Fetches GHL credentials for the given IG account from the database and
 * returns a configured client. Use this for all per-account GHL operations
 * (publish, calendar, etc.). Do not use process.env.GHL_API_KEY for these.
 *
 * @param supabase - Supabase client (server or service role)
 * @param accountId - ig_accounts.id (the Instagram account / sub-account)
 * @returns GHLClient or null if account has no GHL config
 */
export async function getGHLClient(
  supabase: { from: (table: string) => any },
  accountId: string
): Promise<GHLClient | null> {
  const { data: account, error } = await supabase
    .from('ig_accounts')
    .select('ghl_location_id, ghl_social_account_id, ghl_api_key')
    .eq('id', accountId)
    .single()

  if (error || !account) {
    return null
  }

  const apiKey = account.ghl_api_key?.trim()
  const locationId = account.ghl_location_id?.trim()
  const socialAccountId = account.ghl_social_account_id?.trim()

  if (!apiKey || !locationId || !socialAccountId) {
    return null
  }

  const baseUrl = (process.env.GHL_API_BASE || DEFAULT_BASE).replace(/\/$/, '')

  const config: GHLClientConfig = {
    apiKey,
    locationId,
    socialAccountId,
    baseUrl,
    version: GHL_VERSION,
  }

  return {
    config,
    authHeader: `Bearer ${apiKey}`,
    versionHeader: GHL_VERSION,
    baseUrl,
  }
}

/**
 * Same as getGHLClient but throws if the account has no valid GHL config.
 * Use in routes when the operation requires a configured account.
 */
export async function requireGHLClient(
  supabase: { from: (table: string) => any },
  accountId: string
): Promise<GHLClient> {
  const client = await getGHLClient(supabase, accountId)
  if (!client) {
    throw new Error(
      'GHL not configured for this account. Set ghl_location_id, ghl_social_account_id, and ghl_api_key in ig_accounts.'
    )
  }
  return client
}
