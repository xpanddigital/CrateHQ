import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/usage
 *
 * Admin-only. Returns per-account AI spend (this month + lifetime), platform
 * totals, and recent activity. Powers the /admin/tokens dashboard.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // Service client because ai_usage SELECT is restricted to account members +
    // admins by RLS, and we want aggregated everything regardless of admin's
    // own account memberships.
    const service = createServiceClient()

    // Window: start of current UTC month
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    // Lifetime + this-month aggregates per account
    const { data: usageRows, error: usageErr } = await service
      .from('ai_usage')
      .select('account_id, kind, provider, model, cost_cents, occurred_at, input_tokens, output_tokens')
      .gte('occurred_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(10000)

    if (usageErr) {
      logger.error('[Admin/Usage] usage fetch failed:', usageErr)
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
    }

    // Account name lookup
    const { data: accounts } = await service
      .from('accounts')
      .select('id, name, scout_id')

    const accountById = new Map<string, { id: string; name: string; scout_id: string | null }>(
      (accounts ?? []).map(a => [a.id, a as any])
    )

    type AccountAgg = {
      account_id: string
      account_name: string
      lifetime_cents: number
      month_cents: number
      lifetime_calls: number
      month_calls: number
      kind_breakdown: Record<string, { cents: number; calls: number }>
    }
    const perAccount = new Map<string, AccountAgg>()
    let platformLifetimeCents = 0
    let platformMonthCents = 0
    let platformMonthCalls = 0

    for (const row of usageRows ?? []) {
      const acctId = row.account_id ?? '__unattributed__'
      let agg = perAccount.get(acctId)
      if (!agg) {
        const acct = acctId === '__unattributed__'
          ? null
          : accountById.get(acctId)
        agg = {
          account_id: acctId,
          account_name: acct?.name ?? 'Unattributed',
          lifetime_cents: 0,
          month_cents: 0,
          lifetime_calls: 0,
          month_calls: 0,
          kind_breakdown: {},
        }
        perAccount.set(acctId, agg)
      }
      const cents = Number(row.cost_cents) || 0
      agg.lifetime_cents += cents
      agg.lifetime_calls += 1
      platformLifetimeCents += cents

      const occurred = new Date(row.occurred_at)
      const inMonth = occurred >= monthStart
      if (inMonth) {
        agg.month_cents += cents
        agg.month_calls += 1
        platformMonthCents += cents
        platformMonthCalls += 1
      }

      const kind = row.kind || 'unknown'
      if (!agg.kind_breakdown[kind]) agg.kind_breakdown[kind] = { cents: 0, calls: 0 }
      agg.kind_breakdown[kind].cents += cents
      agg.kind_breakdown[kind].calls += 1
    }

    // Sort accounts by month spend desc
    const accountSummaries = Array.from(perAccount.values())
      .sort((a, b) => b.month_cents - a.month_cents)

    // Recent activity feed (most recent 50)
    const recentActivity = (usageRows ?? []).slice(0, 50).map(r => ({
      account_name: r.account_id ? (accountById.get(r.account_id)?.name ?? 'Unattributed') : 'Unattributed',
      kind: r.kind,
      model: r.model,
      provider: r.provider,
      cost_cents: Number(r.cost_cents) || 0,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      occurred_at: r.occurred_at,
    }))

    return NextResponse.json({
      window_start: monthStart.toISOString(),
      platform: {
        lifetime_cents: Math.round(platformLifetimeCents),
        month_cents: Math.round(platformMonthCents),
        month_calls: platformMonthCalls,
      },
      accounts: accountSummaries.map(a => ({
        ...a,
        lifetime_cents: Math.round(a.lifetime_cents),
        month_cents: Math.round(a.month_cents),
      })),
      recent: recentActivity,
    })
  } catch (e: any) {
    logger.error('[Admin/Usage] Unhandled error:', e)
    return NextResponse.json({ error: e?.message ?? 'Internal server error' }, { status: 500 })
  }
}
