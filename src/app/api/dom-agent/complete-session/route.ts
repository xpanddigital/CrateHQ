import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'
import { logger } from '@/lib/logger'
import type { SessionTask, SequenceStep } from '@/types/database'

/**
 * POST /api/dom-agent/complete-session
 * Auth: Agent (Bearer webhook_secret)
 *
 * Reports session execution results from the Playwright executor.
 * Advances enrollments, inserts step logs, updates deal stages.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ig_account_id, session_id, status, task_results, error_message } = body

    const auth = await verifyAgentAuth(
      request.headers.get('authorization'),
      ig_account_id
    )
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    const validStatuses = ['completed', 'failed', 'skipped']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Verify session belongs to this account and is in_progress
    const { data: session, error: sessionError } = await supabase
      .from('session_schedule')
      .select('*')
      .eq('id', session_id)
      .eq('ig_account_id', ig_account_id)
      .eq('status', 'in_progress')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or not in_progress' }, { status: 404 })
    }

    // Update session status
    const { error: updateError } = await supabase
      .from('session_schedule')
      .update({
        status,
        completed_at: new Date().toISOString(),
        result: task_results || null,
        error_message: error_message || null,
      })
      .eq('id', session_id)

    if (updateError) {
      logger.error('[DOM-Agent/CompleteSession] Session update error:', updateError)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    // Process each task result
    let stepsLogged = 0
    let enrollmentsAdvanced = 0
    let dealsUpdated = 0

    const results = Array.isArray(task_results) ? task_results : []

    for (const taskResult of results) {
      const { task_id, task_type, status: taskStatus, actions_completed, started_at, completed_at, duration_seconds, error: taskError } = taskResult

      // Skip organic tasks — no enrollment tracking needed
      if (task_type === 'organic') continue

      // Find the matching task from session
      const sessionTasks = (session.tasks || []) as SessionTask[]
      const originalTask = sessionTasks.find(t => t.task_id === task_id)
      if (!originalTask || !originalTask.enrollment_id) continue

      // Insert step log
      const { error: logError } = await supabase
        .from('sequence_step_log')
        .insert({
          enrollment_id: originalTask.enrollment_id,
          ig_account_id: ig_account_id,
          artist_id: originalTask.artist_id,
          step_number: originalTask.step_number || 0,
          actions_requested: originalTask.actions || [],
          actions_completed: actions_completed || [],
          started_at: started_at || new Date().toISOString(),
          completed_at: completed_at || new Date().toISOString(),
          duration_seconds: duration_seconds || null,
          status: taskStatus === 'success' ? 'success' : taskStatus === 'partial' ? 'partial' : 'failed',
          error_message: taskError || null,
        })

      if (logError) {
        logger.error(`[DOM-Agent/CompleteSession] Step log insert error for task ${task_id}:`, logError)
        continue
      }
      stepsLogged++

      // Advance enrollment if step succeeded or partial
      if (taskStatus === 'success' || taskStatus === 'partial') {
        const advanceResult = await advanceEnrollment(
          supabase,
          originalTask.enrollment_id,
          originalTask.step_number || 0
        )
        if (advanceResult.advanced) enrollmentsAdvanced++

        // Update deal stage for DM tasks: outreach_queued -> contacted
        if (originalTask.dm_pending_message_id && originalTask.artist_id) {
          const { error: dealError } = await supabase
            .from('deals')
            .update({ stage: 'contacted', updated_at: new Date().toISOString() })
            .eq('artist_id', originalTask.artist_id)
            .eq('stage', 'outreach_queued')

          if (dealError) {
            logger.error(`[DOM-Agent/CompleteSession] Deal update error for artist ${originalTask.artist_id}:`, dealError)
          } else {
            dealsUpdated++
          }

          // Update pending_outbound_messages status
          await supabase
            .from('pending_outbound_messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', originalTask.dm_pending_message_id)
        }
      }
    }

    return NextResponse.json({
      session_id,
      status,
      steps_logged: stepsLogged,
      enrollments_advanced: enrollmentsAdvanced,
      deals_updated: dealsUpdated,
    })
  } catch (error) {
    logger.error('[DOM-Agent/CompleteSession] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function advanceEnrollment(
  supabase: any,
  enrollmentId: string,
  completedStep: number
): Promise<{ advanced: boolean }> {
  // Fetch enrollment with template
  const { data: enrollment, error } = await supabase
    .from('sequence_enrollments')
    .select('id, current_step, total_steps, template_id, template:sequence_templates(steps)')
    .eq('id', enrollmentId)
    .eq('status', 'active')
    .single()

  if (error || !enrollment) {
    return { advanced: false }
  }

  const now = new Date().toISOString()

  // Final step → mark completed
  if (enrollment.current_step >= enrollment.total_steps) {
    await supabase
      .from('sequence_enrollments')
      .update({
        status: 'completed',
        last_step_at: now,
        updated_at: now,
      })
      .eq('id', enrollmentId)
    return { advanced: true }
  }

  // Calculate next_step_at from template day_offset
  const templateSteps = (enrollment.template?.steps || []) as SequenceStep[]
  const nextStepDef = templateSteps.find(s => s.step_number === enrollment.current_step + 1)

  let nextStepAt: Date
  if (nextStepDef) {
    const currentStepDef = templateSteps.find(s => s.step_number === enrollment.current_step)
    const dayDelta = nextStepDef.day_offset - (currentStepDef?.day_offset || 0)
    nextStepAt = new Date(Date.now() + dayDelta * 24 * 60 * 60 * 1000)
    // Add ±2 hour jitter
    const jitterMs = (Math.random() * 4 - 2) * 60 * 60 * 1000
    nextStepAt = new Date(nextStepAt.getTime() + jitterMs)
  } else {
    // Fallback: next day
    nextStepAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  }

  await supabase
    .from('sequence_enrollments')
    .update({
      current_step: enrollment.current_step + 1,
      next_step_at: nextStepAt.toISOString(),
      last_step_at: now,
      dm_pending_message_id: null, // Clear for next step
      updated_at: now,
    })
    .eq('id', enrollmentId)

  return { advanced: true }
}
