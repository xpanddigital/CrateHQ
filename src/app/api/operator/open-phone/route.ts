import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCloudPhoneClient } from '@/lib/cloud-phones'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/operator/open-phone
 *
 * Returns a deep-link URL the operator opens in a new tab, and logs the
 * session to cloud_phone_sessions for audit / anchor-violation detection.
 *
 * Body: { ig_account_id: string }
 * Auth: cookie session — caller must be the assigned operator OR an admin
 *       in the owning account.
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const {
      data: { user },
    } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const igAccountId = typeof body.ig_account_id === 'string' ? body.ig_account_id : ''
    if (!igAccountId) {
      return NextResponse.json(
        { error: 'ig_account_id is required' },
        { status: 400 }
      )
    }

    const { data: profile } = await userSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'

    const svc = createServiceClient()
    const { data: phone, error: phoneErr } = await svc
      .from('ig_accounts')
      .select(
        'id, account_id, operator_user_id, cloud_phone_provider, cloud_phone_profile_id'
      )
      .eq('id', igAccountId)
      .maybeSingle()

    if (phoneErr || !phone) {
      return NextResponse.json({ error: 'Phone not found' }, { status: 404 })
    }
    if (!phone.cloud_phone_profile_id || !phone.cloud_phone_provider) {
      return NextResponse.json(
        { error: 'This account has no cloud phone provisioned' },
        { status: 409 }
      )
    }

    // Ownership: assigned operator OR admin in the same account
    let authorized = phone.operator_user_id === user.id || isAdmin
    if (!authorized) {
      // Edge case: an admin that's a member of the owning account but
      // role !== 'admin'. Check membership too — useful for managed VAs.
      const { data: membership } = await svc
        .from('account_members')
        .select('role')
        .eq('account_id', phone.account_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (membership && (membership.role === 'owner' || membership.role === 'admin')) {
        authorized = true
      }
    }
    if (!authorized) {
      return NextResponse.json(
        { error: 'You are not the assigned operator for this phone' },
        { status: 403 }
      )
    }

    // Resolve sub-user creds (if the operator has them). Used by providers
    // that support per-link auto-login; GeeLark currently does not, but the
    // interface accepts them for forward-compat.
    let subUserCreds:
      | { username: string; password: string; subUserId: string }
      | undefined
    const { data: account } = await svc
      .from('accounts')
      .select('cloud_phone_subusers')
      .eq('id', phone.account_id)
      .maybeSingle()
    const subusers = (account?.cloud_phone_subusers ?? {}) as Record<
      string,
      { subuser_username?: string; subuser_password_enc?: string; subuser_id?: string }
    >
    const ownerForCreds = phone.operator_user_id ?? user.id
    const entry = subusers[ownerForCreds]
    if (entry?.subuser_username && entry.subuser_password_enc && entry.subuser_id) {
      try {
        subUserCreds = {
          username: entry.subuser_username,
          password: decrypt(entry.subuser_password_enc),
          subUserId: entry.subuser_id,
        }
      } catch (decryptErr) {
        logger.warn('[Operator/open-phone] sub-user decrypt failed; proceeding without creds:', decryptErr)
      }
    }

    let launchUrl: string
    try {
      const client = getCloudPhoneClient(phone.cloud_phone_provider as 'geelark')
      launchUrl = await client.getPhoneDeepLink(
        phone.cloud_phone_profile_id,
        subUserCreds
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to build deep link'
      logger.error('[Operator/open-phone] provider error:', e)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    // Audit log. Hash the URL (it may contain a short-lived token).
    const forwardedFor = request.headers.get('x-forwarded-for') ?? ''
    const operatorIp = forwardedFor.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') ?? null
    const urlHash = crypto.createHash('sha256').update(launchUrl).digest('hex')

    const { error: logErr } = await svc.from('cloud_phone_sessions').insert({
      account_id: phone.account_id,
      ig_account_id: phone.id,
      operator_user_id: user.id,
      operator_ip: operatorIp,
      user_agent: userAgent,
      deep_link_url_hash: urlHash,
      metadata: { provider: phone.cloud_phone_provider, acting_as_admin: isAdmin },
    })
    if (logErr) {
      // Log but don't block the operator — the audit is best-effort.
      logger.error('[Operator/open-phone] session log insert failed:', logErr)
    }

    // Bookkeeping: keep ig_accounts.last_opened_at fresh for the UI.
    await svc
      .from('ig_accounts')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', phone.id)

    return NextResponse.json({ launch_url: launchUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    logger.error('[Operator/open-phone] Unhandled error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
