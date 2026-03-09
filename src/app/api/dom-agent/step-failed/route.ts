import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'
import { logger } from '@/lib/logger'

const MAX_RETRIES = 3

/**
 * POST /api/dom-agent/step-failed
 * Auth: Agent (Bearer webhook_secret)
 *
 * Reports a single step failure from the Playwright executor.
 * Increments retry counter; if retries > MAX_RETRIES, marks enrollment as failed.
 * Otherwise reschedules for tomorrow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      ig_account_id,
      session_id,
      task_id,
      enrollment_id,
      step_number,
      error_message,
      actions_completed,
    } = body

    const auth = await verifyAgentAuth(
      request.headers.get('authorization'),
      ig_account_id
    )
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    if (!enrollment_id) {
      return NextResponse.json({ error: 'enrollment_id is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Insert step log as failed
    const { error: logError } = await supabase
      .from('sequence_step_log')
      .insert({
        enrollment_id,
        ig_account_id,
        artist_id: body.artist_id || null,
        step_number: step_number || 0,
        actions_requested: body.actions_requested || [],
        actions_completed: actions_completed || [],
        started_at: body.started_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: body.duration_seconds || null,
        status: 'failed',
        error_message: error_message || 'Unknown error',
      })

    if (logError) {
      logger.error(`[DOM-Agent/StepFailed] Step log insert error:`, logError)
    }

    // Count recent failures for this enrollment
    const { count: failureCount } = await supabase
      .from('sequence_step_log')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment_id)
      .eq('status', 'failed')

    const totalFailures = failureCount ?? 0

    if (totalFailures > MAX_RETRIES) {
      // Mark enrollment as failed
      const { error: failError } = await supabase
        .from('sequence_enrollments')
        .update({
          status: 'failed',
          error_message: `Failed after ${totalFailures} attempts: ${error_message || 'Unknown error'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment_id)
        .eq('status', 'active')

      if (failError) {
        logger.error(`[DOM-Agent/StepFailed] Enrollment fail update error:`, failError)
      }

      logger.warn(`[DOM-Agent/StepFailed] Enrollment ${enrollment_id} marked as failed after ${totalFailures} attempts`)

      return NextResponse.json({
        enrollment_id,
        action: 'failed',
        total_failures: totalFailures,
        message: `Enrollment marked as failed after ${totalFailures} attempts`,
      })
    } else {
      // Reschedule for tomorrow with jitter
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const jitterMs = (Math.random() * 4 - 2) * 60 * 60 * 1000
      const nextStepAt = new Date(tomorrow.getTime() + jitterMs)

      const { error: rescheduleError } = await supabase
        .from('sequence_enrollments')
        .update({
          next_step_at: nextStepAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment_id)
        .eq('status', 'active')

      if (rescheduleError) {
        logger.error(`[DOM-Agent/StepFailed] Enrollment reschedule error:`, rescheduleError)
      }

      logger.info(`[DOM-Agent/StepFailed] Enrollment ${enrollment_id} rescheduled for ${nextStepAt.toISOString()} (attempt ${totalFailures}/${MAX_RETRIES})`)

      return NextResponse.json({
        enrollment_id,
        action: 'rescheduled',
        total_failures: totalFailures,
        next_step_at: nextStepAt.toISOString(),
      })
    }
  } catch (error) {
    logger.error('[DOM-Agent/StepFailed] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
