import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import type { SequenceStep, SessionTask } from '@/types/database'
import crypto from 'crypto'

export const maxDuration = 300

/**
 * POST /api/sequences/generate-schedule
 * Auth: Cron (Bearer CRON_SECRET) or Admin (cookie session)
 *
 * Generates the daily session_schedule for all active IG accounts.
 * Called once daily at 00:05 UTC via Vercel cron.
 */
export async function POST(request: NextRequest) {
  // Auth: support both cron token and admin session
  const authHeader = request.headers.get('authorization')
  const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCronAuth) {
    // Fall back to admin session auth
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await userSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
  }

  const supabase = createServiceClient()
  const startTime = Date.now()

  try {
    // Fetch all active IG accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('ig_accounts')
      .select('id, ig_username, active_start_hour, active_end_hour, timezone, daily_cold_dm_limit')
      .eq('is_active', true)

    if (accountsError) {
      logger.error('[Scheduler] Failed to fetch accounts:', accountsError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ summary: 'No active accounts', sessions_created: 0 })
    }

    // End of today (UTC)
    const endOfToday = new Date()
    endOfToday.setUTCHours(23, 59, 59, 999)

    // Anthropic client for comment generation
    let anthropic: Anthropic | null = null
    if (process.env.ANTHROPIC_API_KEY) {
      anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    }

    let totalSessionsCreated = 0
    let totalStepsScheduled = 0
    let totalDmsQueued = 0
    const accountSummaries: any[] = []

    for (const account of accounts) {
      // Safety: leave 30s buffer before Vercel timeout
      if (Date.now() - startTime > 250_000) {
        logger.warn('[Scheduler] Timeout approaching, stopping early')
        break
      }

      try {
        const result = await generateAccountSchedule(
          supabase,
          anthropic,
          account,
          endOfToday
        )
        totalSessionsCreated += result.sessionsCreated
        totalStepsScheduled += result.stepsScheduled
        totalDmsQueued += result.dmsQueued
        accountSummaries.push({
          ig_username: account.ig_username,
          ...result,
        })
      } catch (accountErr) {
        logger.error(`[Scheduler] Error for account ${account.ig_username}:`, accountErr)
        accountSummaries.push({
          ig_username: account.ig_username,
          error: String(accountErr),
        })
      }
    }

    return NextResponse.json({
      summary: 'Schedule generated',
      sessions_created: totalSessionsCreated,
      steps_scheduled: totalStepsScheduled,
      dms_queued: totalDmsQueued,
      accounts: accountSummaries,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (err) {
    logger.error('[Scheduler] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateAccountSchedule(
  supabase: any,
  anthropic: Anthropic | null,
  account: any,
  endOfToday: Date
) {
  const result = { sessionsCreated: 0, stepsScheduled: 0, dmsQueued: 0, dmsPushed: 0 }

  // 1. Fetch active enrollments due today
  const { data: enrollments, error: enrollError } = await supabase
    .from('sequence_enrollments')
    .select(`
      id, artist_id, template_id, current_step, total_steps,
      next_step_at, dm_message_text, dm_pending_message_id, scout_id,
      artist:artists(id, name, instagram_handle, biography, spotify_monthly_listeners, genres, estimated_offer_low, estimated_offer_high),
      template:sequence_templates(id, steps)
    `)
    .eq('ig_account_id', account.id)
    .eq('status', 'active')
    .lte('next_step_at', endOfToday.toISOString())
    .order('next_step_at', { ascending: true })

  if (enrollError) {
    logger.error(`[Scheduler] Enrollment fetch error for ${account.ig_username}:`, enrollError)
    return result
  }

  if (!enrollments || enrollments.length === 0) {
    // Generate 1 organic-only session to maintain activity baseline
    await createSession(supabase, account, 'organic_only', [], account.active_start_hour + 2)
    result.sessionsCreated = 1
    return result
  }

  // 2. Pre-check daily DM capacity
  const dailyLimit = account.daily_cold_dm_limit ?? 3
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count: existingDmCount } = await supabase
    .from('pending_outbound_messages')
    .select('*', { count: 'exact', head: true })
    .eq('ig_account_id', account.id)
    .eq('outreach_type', 'cold')
    .gte('created_at', startOfDay.toISOString())

  let remainingDmCapacity = Math.max(0, dailyLimit - (existingDmCount ?? 0))

  // 3. Separate DM steps from engagement steps
  const dmSteps: any[] = []
  const engagementSteps: any[] = []

  for (const enrollment of enrollments) {
    const templateSteps = (enrollment.template?.steps || []) as SequenceStep[]
    const currentStepDef = templateSteps.find(s => s.step_number === enrollment.current_step)
    if (!currentStepDef) continue

    const hasDm = currentStepDef.actions.some(a => a.type === 'send_dm')

    if (hasDm) {
      if (remainingDmCapacity > 0) {
        dmSteps.push({ enrollment, stepDef: currentStepDef })
        remainingDmCapacity--
      } else {
        // Push to tomorrow
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const jitterMs = (Math.random() * 4 - 2) * 60 * 60 * 1000
        await supabase
          .from('sequence_enrollments')
          .update({ next_step_at: new Date(tomorrow.getTime() + jitterMs).toISOString() })
          .eq('id', enrollment.id)
        result.dmsPushed++
      }
    } else {
      engagementSteps.push({ enrollment, stepDef: currentStepDef })
    }
  }

  const allSteps = [...engagementSteps, ...dmSteps]

  // Cap at 7 steps per day
  if (allSteps.length > 7) {
    const excess = allSteps.splice(7)
    for (const { enrollment } of excess) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await supabase
        .from('sequence_enrollments')
        .update({ next_step_at: tomorrow.toISOString() })
        .eq('id', enrollment.id)
    }
  }

  // 4. Determine session count
  let sessionCount: number
  if (allSteps.length === 0) {
    sessionCount = 1
  } else if (allSteps.length <= 3) {
    sessionCount = 2
  } else {
    sessionCount = 3
  }

  // 5. Distribute steps across sessions (DMs never in first session)
  const sessionSteps: any[][] = Array.from({ length: sessionCount }, () => [])

  // Engagement steps go anywhere
  for (let i = 0; i < engagementSteps.length && i < allSteps.length; i++) {
    const sessionIdx = i % sessionCount
    sessionSteps[sessionIdx].push(engagementSteps[i])
  }

  // DM steps go in session 2 or 3 (never first)
  for (let i = 0; i < dmSteps.length; i++) {
    const sessionIdx = Math.min(1 + (i % (sessionCount - 1)), sessionCount - 1)
    sessionSteps[sessionIdx].push(dmSteps[i])
  }

  // 6. Generate session times
  const activeStart = account.active_start_hour || 8
  const activeEnd = account.active_end_hour || 22

  const sessionTimes = [
    activeStart + Math.random() * 3,                    // Session 1: early
    12 + Math.random() * 4,                              // Session 2: midday
    17 + Math.random() * (activeEnd - 18),               // Session 3: evening
  ].slice(0, sessionCount).map(h => {
    // Add ±30 min jitter
    const jitter = (Math.random() - 0.5) * 60 // minutes
    return Math.max(activeStart, Math.min(activeEnd - 1, h + jitter / 60))
  })

  // 20% chance to skip session 3
  if (sessionCount === 3 && allSteps.length <= 3 && Math.random() < 0.2) {
    // Move session 3 steps to session 2
    sessionSteps[1].push(...sessionSteps[2])
    sessionSteps.pop()
    sessionTimes.pop()
    sessionCount = 2
  }

  // 7. Build task lists and create sessions
  for (let s = 0; s < sessionSteps.length; s++) {
    const steps = sessionSteps[s]
    const tasks: SessionTask[] = []

    // Opening organic block
    tasks.push(buildOrganicTask(['scroll_feed', 'watch_stories'], [5, 15]))

    for (let i = 0; i < steps.length; i++) {
      const { enrollment, stepDef } = steps[i]
      const artist = enrollment.artist

      // Build sequence step task
      const task: SessionTask = {
        task_id: crypto.randomUUID(),
        task_type: 'sequence_step',
        enrollment_id: enrollment.id,
        artist_id: artist?.id,
        target_username: artist?.instagram_handle,
        step_number: stepDef.step_number,
        actions: stepDef.actions,
      }

      // Handle send_dm actions
      if (stepDef.actions.some((a: any) => a.type === 'send_dm')) {
        // Generate DM via existing generate-cold pattern
        const dmText = enrollment.dm_message_text || null

        if (dmText) {
          // Insert into pending_outbound_messages
          const { data: pendingMsg, error: insertErr } = await supabase
            .from('pending_outbound_messages')
            .insert({
              ig_account_id: account.id,
              scout_id: enrollment.scout_id,
              artist_id: artist?.id,
              target_username: artist?.instagram_handle,
              outreach_type: 'cold',
              status: 'sending', // Prevents old dm_agent.py pickup
              message_text: dmText,
              is_approved: false, // Admin must approve
            })
            .select('id')
            .single()

          if (insertErr) {
            logger.error(`[Scheduler] DM insert error for ${artist?.name}:`, insertErr)
          } else {
            task.dm_pending_message_id = pendingMsg.id
            task.dm_message_text = dmText
            task.dm_approved = false

            // Link to enrollment
            await supabase
              .from('sequence_enrollments')
              .update({ dm_pending_message_id: pendingMsg.id })
              .eq('id', enrollment.id)

            result.dmsQueued++
          }
        } else {
          logger.warn(`[Scheduler] No DM text for enrollment ${enrollment.id}, skipping DM queue`)
        }
      }

      // Handle comment actions — generate text server-side
      for (const action of stepDef.actions) {
        if (action.type === 'comment' && anthropic && artist) {
          try {
            const commentResp = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 30,
              messages: [{
                role: 'user',
                content: `Write a very short, authentic Instagram comment (4-10 words) for a music post by ${artist.name || 'an artist'}. Genres: ${(artist.genres || []).join(', ') || 'various'}. Sound like a real fan. No emojis, no hashtags. Just a genuine reaction. Examples: "this is so good", "the production on this is insane", "been on repeat all week". Only output the comment text, nothing else.`,
              }],
            })
            const commentText = commentResp.content[0]?.type === 'text'
              ? commentResp.content[0].text.trim().replace(/^["']|["']$/g, '')
              : null
            if (commentText) {
              task.comment_text = commentText
            }
          } catch (commentErr) {
            logger.error(`[Scheduler] Comment generation failed for ${artist.name}:`, commentErr)
          }
        }
      }

      tasks.push(task)

      // Organic interlude between steps
      if (i < steps.length - 1) {
        tasks.push(buildOrganicTask(['scroll_feed', 'browse_explore'], [3, 10]))
      }
    }

    // Closing organic block
    tasks.push(buildOrganicTask(['scroll_feed'], [3, 8]))

    // Determine session type
    const hasDmTask = tasks.some(t => t.dm_pending_message_id)
    const hasSequenceTask = tasks.some(t => t.task_type === 'sequence_step')
    const sessionType = hasDmTask ? 'outreach' : hasSequenceTask ? 'engagement' : 'organic_only'

    // Calculate scheduled_start timestamp
    const now = new Date()
    const scheduledStart = new Date(now)
    const sessionHour = sessionTimes[s]
    scheduledStart.setUTCHours(Math.floor(sessionHour), Math.round((sessionHour % 1) * 60), 0, 0)

    // If scheduled_start is in the past, push to tomorrow
    if (scheduledStart <= now) {
      scheduledStart.setDate(scheduledStart.getDate() + 1)
    }

    await createSession(supabase, account, sessionType, tasks, sessionHour, scheduledStart)
    result.sessionsCreated++
    result.stepsScheduled += steps.length
  }

  return result
}

function buildOrganicTask(actionTypes: string[], durationRange: [number, number]): SessionTask {
  return {
    task_id: crypto.randomUUID(),
    task_type: 'organic',
    actions: actionTypes.map(type => ({
      type: type as any,
      duration_range: durationRange,
    })),
  }
}

async function createSession(
  supabase: any,
  account: any,
  sessionType: string,
  tasks: SessionTask[],
  _sessionHour: number,
  scheduledStart?: Date
) {
  const start = scheduledStart || new Date()

  const { error: insertError } = await supabase
    .from('session_schedule')
    .insert({
      ig_account_id: account.id,
      scheduled_start: start.toISOString(),
      session_type: sessionType,
      tasks,
      status: 'pending',
    })

  if (insertError) {
    logger.error(`[Scheduler] Session insert error for ${account.ig_username}:`, insertError)
  }
}
