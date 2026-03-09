import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase: null as any, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase: null as any, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, error: null }
}

/**
 * GET /api/sequences/analytics
 * Auth: Admin
 *
 * Returns dashboard metrics for the nurture sequence engine.
 */
export async function GET(_request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(0, 0, 0, 0)

    // Run all queries in parallel
    const [
      activeEnrollments,
      byStatus,
      completedToday,
      dmsSentToday,
      sessionsToday,
      byAccount,
      byStep,
    ] = await Promise.all([
      // Total active enrollments
      supabase
        .from('sequence_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Enrollments by status
      supabase
        .from('sequence_enrollments')
        .select('status'),

      // Completed today
      supabase
        .from('sequence_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', startOfDay.toISOString()),

      // DMs sent today
      supabase
        .from('pending_outbound_messages')
        .select('*', { count: 'exact', head: true })
        .eq('outreach_type', 'cold')
        .gte('created_at', startOfDay.toISOString()),

      // Sessions today
      supabase
        .from('session_schedule')
        .select('status, session_type')
        .gte('scheduled_start', startOfDay.toISOString()),

      // Enrollments by IG account
      supabase
        .from('sequence_enrollments')
        .select('ig_account_id, status')
        .eq('status', 'active'),

      // Active enrollments by current step
      supabase
        .from('sequence_enrollments')
        .select('current_step, total_steps')
        .eq('status', 'active'),
    ])

    // Aggregate by-status counts
    const statusCounts: Record<string, number> = {}
    for (const row of byStatus.data || []) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1
    }

    // Aggregate sessions by status
    const sessionsByStatus: Record<string, number> = {}
    const sessionsByType: Record<string, number> = {}
    for (const row of sessionsToday.data || []) {
      sessionsByStatus[row.status] = (sessionsByStatus[row.status] || 0) + 1
      sessionsByType[row.session_type] = (sessionsByType[row.session_type] || 0) + 1
    }

    // Aggregate by-account
    const accountCounts: Record<string, number> = {}
    for (const row of byAccount.data || []) {
      accountCounts[row.ig_account_id] = (accountCounts[row.ig_account_id] || 0) + 1
    }

    // Aggregate by-step
    const stepCounts: Record<string, number> = {}
    for (const row of byStep.data || []) {
      const key = `${row.current_step}/${row.total_steps}`
      stepCounts[key] = (stepCounts[key] || 0) + 1
    }

    return NextResponse.json({
      active_enrollments: activeEnrollments.count ?? 0,
      by_status: statusCounts,
      completed_today: completedToday.count ?? 0,
      dms_queued_today: dmsSentToday.count ?? 0,
      sessions_today: {
        total: sessionsToday.data?.length ?? 0,
        by_status: sessionsByStatus,
        by_type: sessionsByType,
      },
      by_account: accountCounts,
      by_step: stepCounts,
    })
  } catch (err) {
    logger.error('[Sequences/Analytics] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
