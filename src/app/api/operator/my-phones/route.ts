import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/operator/my-phones
 *
 * Returns the cloud phones assigned to the calling user. Used by the
 * operator daily worklist at /operator/phones.
 *
 * Admins see every phone in their account (so an admin can demo the
 * page even without being assigned phones directly).
 */
export async function GET() {
  try {
    const userSupabase = await createClient()
    const {
      data: { user },
    } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await userSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'

    const svc = createServiceClient()

    // Pull every ig_account the caller can see. Operators see only what
    // they're assigned to; admins see every phone in every account they
    // belong to (we let RLS sort that out via the user-bound client first,
    // then service-role for the join data).
    let phonesQuery = svc
      .from('ig_accounts')
      .select(
        'id, ig_username, account_id, cloud_phone_provider, cloud_phone_profile_id, operator_user_id, daily_cold_dm_limit, last_opened_at, provisioned_at, is_active'
      )
      .not('cloud_phone_profile_id', 'is', null)

    if (!isAdmin) {
      phonesQuery = phonesQuery.eq('operator_user_id', user.id)
    } else {
      // Admin: scope to their account(s)
      const { data: memberships } = await svc
        .from('account_members')
        .select('account_id')
        .eq('user_id', user.id)
      const accountIds = (memberships ?? []).map((m) => m.account_id)
      if (accountIds.length === 0) return NextResponse.json({ phones: [] })
      phonesQuery = phonesQuery.in('account_id', accountIds)
    }

    const { data: phones, error: phonesErr } = await phonesQuery
    if (phonesErr) {
      logger.error('[Operator/my-phones] phone query failed:', phonesErr)
      return NextResponse.json(
        { error: 'Failed to load phones' },
        { status: 500 }
      )
    }
    if (!phones || phones.length === 0) {
      return NextResponse.json({ phones: [] })
    }

    const igAccountIds = phones.map((p) => p.id)

    // Identity rows for display name + status
    const { data: identities } = await svc
      .from('account_identities')
      .select('ig_account_id, display_name, ig_status, warming_until')
      .in('ig_account_id', igAccountIds)
    type IdentityRow = NonNullable<typeof identities>[number]
    const identityByIgAccount = new Map<string, IdentityRow>()
    for (const id of identities ?? []) {
      if (id.ig_account_id) identityByIgAccount.set(id.ig_account_id, id)
    }

    // Today's sent counts. The semantic is "messages sent today" — we count
    // every pending_outbound_messages row with sent_at >= start-of-today UTC.
    // Replies and cold openers both count against daily_cold_dm_limit; v1
    // does not distinguish them. Good enough as a guardrail.
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { data: sentToday } = await svc
      .from('pending_outbound_messages')
      .select('ig_account_id')
      .in('ig_account_id', igAccountIds)
      .gte('sent_at', todayStart.toISOString())
    const sentCounts = new Map<string, number>()
    for (const row of sentToday ?? []) {
      sentCounts.set(row.ig_account_id, (sentCounts.get(row.ig_account_id) ?? 0) + 1)
    }

    const result = phones.map((p) => {
      const identity = identityByIgAccount.get(p.id)
      const sent = sentCounts.get(p.id) ?? 0
      const limit = p.daily_cold_dm_limit ?? 0
      return {
        ig_account_id: p.id,
        ig_username: p.ig_username,
        display_name: identity?.display_name ?? p.ig_username,
        cloud_phone_provider: p.cloud_phone_provider,
        status: (identity?.ig_status ?? (p.is_active ? 'ready' : 'provisioning')) as
          | 'ready'
          | 'warming'
          | 'provisioning'
          | 'failed',
        warming_until: identity?.warming_until ?? null,
        last_opened_at: p.last_opened_at,
        today_dms_sent: sent,
        today_dms_remaining: Math.max(0, limit - sent),
      }
    })

    // Sort: most-headroom-first so operators tackle the under-used phones
    result.sort((a, b) => b.today_dms_remaining - a.today_dms_remaining)

    return NextResponse.json({ phones: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    logger.error('[Operator/my-phones] Unhandled error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
