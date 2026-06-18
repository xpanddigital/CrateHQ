import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAccountIdForUser } from '@/lib/auth/account'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'
import { logger } from '@/lib/logger'

const ALLOWED_SERVICES = ['instantly', 'apify', 'anthropic', 'ghl'] as const
const SENSITIVE_FIELDS = ['api_key'] as const

/**
 * Safely decrypt a stored credential. If it was stored as plaintext (legacy
 * rows from before encryption was wired up), pass through and log so we can
 * spot un-migrated rows.
 */
function maybeDecrypt(value: string | null | undefined, context: string): string | null {
  if (!value) return null
  if (!isEncrypted(value)) {
    logger.warn(`[Integrations] Plaintext credential detected for ${context} — will be re-encrypted on next save`)
    return value
  }
  try {
    return decrypt(value)
  } catch (e) {
    logger.error(`[Integrations] Decrypt failed for ${context}:`, e)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    // Decrypt sensitive fields before returning
    const decrypted = (integrations || []).map((row) => ({
      ...row,
      api_key: maybeDecrypt(row.api_key, `${row.service}:${row.id}`),
    }))

    return NextResponse.json({ integrations: decrypted })
  } catch (error: any) {
    logger.error('Error fetching integrations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch integrations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { service, api_key, config } = await request.json()

    if (!service || !ALLOWED_SERVICES.includes(service)) {
      return NextResponse.json(
        { error: `service must be one of: ${ALLOWED_SERVICES.join(', ')}` },
        { status: 400 }
      )
    }

    const encryptedKey = api_key ? encrypt(api_key) : null

    const accountId = await resolveAccountIdForUser(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'No account is associated with your user. Contact your admin.' },
        { status: 403 }
      )
    }

    const { data: integration, error } = await supabase
      .from('integrations')
      .upsert({
        account_id: accountId,
        user_id: user.id,
        service,
        api_key: encryptedKey,
        config: config || {},
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    // Don't echo the encrypted blob back. Callers know the plaintext they sent.
    return NextResponse.json(
      { integration: { ...integration, api_key: api_key ? '<encrypted>' : null } },
      { status: 201 }
    )
  } catch (error: any) {
    logger.error('Error saving integration:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save integration' },
      { status: 500 }
    )
  }
}
