import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'
import { logger } from '@/lib/logger'
import type { SessionTask } from '@/types/database'

/**
 * GET /api/dom-agent/next-session?ig_account_id=xxx
 * Auth: Agent (Bearer webhook_secret)
 *
 * Returns the next pending session for the Playwright executor.
 * Kill switch: returns { session: null } if account is deactivated.
 */
export async function GET(request: NextRequest) {
  try {
    const igAccountId = request.nextUrl.searchParams.get('ig_account_id')

    const auth = await verifyAgentAuth(
      request.headers.get('authorization'),
      igAccountId
    )
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    // Kill switch — verifyAgentAuth already checks is_active,
    // but we return a soft null instead of 401 for deactivated accounts
    if (!auth.account.is_active) {
      return NextResponse.json({ session: null })
    }

    const supabase = createServiceClient()

    // Find earliest pending session where scheduled_start <= now
    const now = new Date().toISOString()
    const { data: session, error: sessionError } = await supabase
      .from('session_schedule')
      .select('*')
      .eq('ig_account_id', igAccountId!)
      .eq('status', 'pending')
      .lte('scheduled_start', now)
      .order('scheduled_start', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (sessionError) {
      logger.error('[DOM-Agent/NextSession] Session fetch error:', sessionError)
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ session: null })
    }

    // Mark session as in_progress
    const { error: updateError } = await supabase
      .from('session_schedule')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('status', 'pending') // Prevent double-pickup race condition

    if (updateError) {
      logger.error('[DOM-Agent/NextSession] Session update error:', updateError)
      return NextResponse.json({ error: 'Failed to claim session' }, { status: 500 })
    }

    // Enrich DM tasks with current approval status
    const tasks = (session.tasks || []) as SessionTask[]
    const dmTaskIds = tasks
      .filter(t => t.dm_pending_message_id)
      .map(t => t.dm_pending_message_id!)

    if (dmTaskIds.length > 0) {
      const { data: pendingMsgs } = await supabase
        .from('pending_outbound_messages')
        .select('id, is_approved')
        .in('id', dmTaskIds)

      if (pendingMsgs) {
        const approvalMap = new Map(pendingMsgs.map(m => [m.id, m.is_approved]))
        for (const task of tasks) {
          if (task.dm_pending_message_id) {
            task.dm_approved = approvalMap.get(task.dm_pending_message_id) ?? false
          }
        }
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        ig_account_id: session.ig_account_id,
        session_type: session.session_type,
        scheduled_start: session.scheduled_start,
        tasks,
      },
    })
  } catch (error) {
    logger.error('[DOM-Agent/NextSession] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
