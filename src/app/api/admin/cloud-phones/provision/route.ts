import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCloudPhoneClient, SubUserApiNotSupportedError } from '@/lib/cloud-phones'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface Assignment {
  label?: string
  operator_user_id?: string
}

/**
 * POST /api/admin/cloud-phones/provision
 *
 * Bulk-provisions N phones for a given account. Each phone:
 *   1. Created in GeeLark via the cloud-phone client
 *   2. Persisted as an ig_accounts row with provider + profile id
 *   3. If an operator was specified AND has a GeeLark sub-user, the phone
 *      is scoped to that sub-user. Otherwise the phone gets returned with
 *      needs_manual_assignment=true so the admin can either create the
 *      sub-user (POST /api/admin/cloud-phones/create-subuser) and retry,
 *      or assign it manually in the GeeLark dashboard.
 *
 * Body: { account_id, count, assignments?: [{label?, operator_user_id?}] }
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
    const count = Number.isInteger(body.count) ? (body.count as number) : 0
    const assignments: Assignment[] = Array.isArray(body.assignments)
      ? body.assignments
      : []

    if (!accountId) {
      return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
    }
    if (count < 1 || count > 50) {
      return NextResponse.json(
        { error: 'count must be between 1 and 50' },
        { status: 400 }
      )
    }

    const svc = createServiceClient()

    // Validate the account exists
    const { data: account } = await svc
      .from('accounts')
      .select('id, name, cloud_phone_subusers, cloud_phone_provider')
      .eq('id', accountId)
      .maybeSingle()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const subusers = (account.cloud_phone_subusers ?? {}) as Record<
      string,
      { subuser_id?: string }
    >

    const provider = 'geelark' as const
    const client = getCloudPhoneClient(provider)

    type ResultRow = {
      ig_account_id: string
      cloud_phone_profile_id: string
      operator_user_id: string | null
      needs_manual_assignment: boolean
      error?: string
    }
    const results: ResultRow[] = []

    for (let i = 0; i < count; i++) {
      const assignment = assignments[i] ?? {}
      const operatorUserId =
        typeof assignment.operator_user_id === 'string' && assignment.operator_user_id
          ? assignment.operator_user_id
          : null
      const label =
        (typeof assignment.label === 'string' && assignment.label.trim()) ||
        `${account.name}-phone-${Date.now().toString(36)}-${i + 1}`

      let provisioned
      try {
        provisioned = await client.provisionPhone({ label })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'provision failed'
        logger.error('[Admin/cloud-phones/provision] provider error:', e)
        results.push({
          ig_account_id: '',
          cloud_phone_profile_id: '',
          operator_user_id: operatorUserId,
          needs_manual_assignment: true,
          error: msg,
        })
        continue
      }

      const igAccountId = crypto.randomUUID()
      const webhookSecret = crypto.randomBytes(24).toString('hex')
      // Placeholder username — operator fills the real handle in after they
      // create the IG account on the freshly provisioned phone. Unique to
      // satisfy any future unique index.
      const placeholderUsername = `pending-${igAccountId.slice(0, 12)}`

      const { error: insertErr } = await svc.from('ig_accounts').insert({
        id: igAccountId,
        account_id: accountId,
        ig_username: placeholderUsername,
        webhook_secret: webhookSecret,
        cloud_phone_provider: provider,
        cloud_phone_profile_id: provisioned.profileId,
        operator_user_id: operatorUserId,
        provisioned_at: new Date().toISOString(),
        is_active: false, // becomes true once the operator confirms IG account exists
      })
      if (insertErr) {
        logger.error('[Admin/cloud-phones/provision] ig_accounts insert failed:', insertErr)
        // Try to shut down the orphaned phone so we don't leak inventory
        try {
          await client.shutdownPhone(provisioned.profileId)
        } catch (sd) {
          logger.error('[Admin/cloud-phones/provision] orphan shutdown failed:', sd)
        }
        results.push({
          ig_account_id: '',
          cloud_phone_profile_id: provisioned.profileId,
          operator_user_id: operatorUserId,
          needs_manual_assignment: true,
          error: insertErr.message,
        })
        continue
      }

      // Optionally scope to sub-user in GeeLark
      let needsManualAssignment = !operatorUserId
      if (operatorUserId) {
        const subUserId = subusers[operatorUserId]?.subuser_id
        if (subUserId) {
          try {
            await client.assignPhoneToSubUser(provisioned.profileId, subUserId)
            needsManualAssignment = false
          } catch (e: unknown) {
            // Expected for GeeLark: their API doesn't expose sub-user
            // assignment. Admin assigns phone → sub-user in the GeeLark
            // dashboard. Only log unexpected errors.
            if (!(e instanceof SubUserApiNotSupportedError)) {
              logger.warn('[Admin/cloud-phones/provision] sub-user assign failed:', e)
            }
            needsManualAssignment = true
          }
        } else {
          needsManualAssignment = true
        }
      }

      // Stamp the cloud_phone_provider on the account if not yet set
      if (!account.cloud_phone_provider) {
        await svc
          .from('accounts')
          .update({ cloud_phone_provider: provider })
          .eq('id', accountId)
      }

      results.push({
        ig_account_id: igAccountId,
        cloud_phone_profile_id: provisioned.profileId,
        operator_user_id: operatorUserId,
        needs_manual_assignment: needsManualAssignment,
      })
    }

    const provisionedCount = results.filter((r) => r.ig_account_id).length

    return NextResponse.json({
      provisioned: provisionedCount,
      requested: count,
      phones: results,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    logger.error('[Admin/cloud-phones/provision] Unhandled error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
