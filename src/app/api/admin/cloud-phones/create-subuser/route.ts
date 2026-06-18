import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCloudPhoneClient, SubUserApiNotSupportedError } from '@/lib/cloud-phones'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/cloud-phones/create-subuser
 *
 * Two modes:
 *
 * 1. API mode (default) — calls the cloud-phone provider's createSubUser API.
 *    On success, encrypts the returned password and persists to
 *    accounts.cloud_phone_subusers[operator_user_id]. Plaintext password
 *    is returned ONCE to the caller (admin) so they can email it to the
 *    operator via Resend or a one-time link.
 *
 * 2. Manual mode — admin already created the sub-user in GeeLark's
 *    dashboard and POSTs `manual_creds: { username, password, subuser_id }`.
 *    We skip the API call, encrypt, and persist. Same return shape.
 *
 * Body: {
 *   account_id, operator_user_id, display_name,
 *   manual_creds?: { username, password, subuser_id }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const {
      data: { user },
    } = await userSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await userSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const accountId = typeof body.account_id === 'string' ? body.account_id : ''
    const operatorUserId =
      typeof body.operator_user_id === 'string' ? body.operator_user_id : ''
    const displayName =
      typeof body.display_name === 'string' && body.display_name.trim()
        ? body.display_name.trim()
        : ''
    const manualCreds = body.manual_creds as
      | { username?: string; password?: string; subuser_id?: string }
      | undefined

    if (!accountId || !operatorUserId || !displayName) {
      return NextResponse.json(
        { error: 'account_id, operator_user_id, and display_name are required' },
        { status: 400 }
      )
    }

    const svc = createServiceClient()

    const { data: account } = await svc
      .from('accounts')
      .select('id, cloud_phone_subusers')
      .eq('id', accountId)
      .maybeSingle()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    let creds: { username: string; password: string; subUserId: string }
    let returnPlaintextPassword = true

    if (manualCreds) {
      if (
        !manualCreds.username ||
        !manualCreds.password ||
        !manualCreds.subuser_id
      ) {
        return NextResponse.json(
          {
            error:
              'manual_creds must include username, password, and subuser_id (all from the GeeLark dashboard)',
          },
          { status: 400 }
        )
      }
      creds = {
        username: manualCreds.username,
        password: manualCreds.password,
        subUserId: manualCreds.subuser_id,
      }
      // In manual mode the admin already has the plaintext password, no
      // need to echo it back.
      returnPlaintextPassword = false
    } else {
      const client = getCloudPhoneClient('geelark')
      try {
        creds = await client.createSubUser({ displayName })
      } catch (e: unknown) {
        if (e instanceof SubUserApiNotSupportedError) {
          return NextResponse.json(
            {
              error: 'Sub-user creation via API not supported by this provider',
              action_required:
                'Create the sub-user manually in the GeeLark dashboard (Team → Add Sub-User), then re-POST to this endpoint with manual_creds: { username, password, subuser_id }.',
            },
            { status: 422 }
          )
        }
        const msg = e instanceof Error ? e.message : 'createSubUser failed'
        logger.error('[Admin/cloud-phones/create-subuser] provider error:', e)
        return NextResponse.json({ error: msg }, { status: 502 })
      }
    }

    const subusers = {
      ...((account.cloud_phone_subusers ?? {}) as Record<string, unknown>),
      [operatorUserId]: {
        subuser_username: creds.username,
        subuser_password_enc: encrypt(creds.password),
        subuser_id: creds.subUserId,
        created_at: new Date().toISOString(),
        created_by: user.id,
      },
    }

    const { error: updErr } = await svc
      .from('accounts')
      .update({ cloud_phone_subusers: subusers })
      .eq('id', accountId)

    if (updErr) {
      logger.error('[Admin/cloud-phones/create-subuser] account update failed:', updErr)
      return NextResponse.json(
        { error: 'Failed to persist sub-user credentials' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subuser_id: creds.subUserId,
      username: creds.username,
      // Plaintext shown to admin ONCE on API creation so they can deliver
      // it to the operator securely. Never shown on manual mode (they
      // typed it in already).
      password: returnPlaintextPassword ? creds.password : undefined,
      message: returnPlaintextPassword
        ? 'Send these credentials to the operator securely (1Password, signal, or a one-time link). They will not be shown again.'
        : 'Manual credentials persisted. Encrypted at rest.',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    logger.error('[Admin/cloud-phones/create-subuser] Unhandled error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
