import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ig_account_id, status, messages_found, messages_sent, error_detail } = body

    if (!ig_account_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: ig_account_id, status' },
        { status: 400 }
      )
    }

    const auth = await verifyAgentAuth(
      request.headers.get('authorization'),
      ig_account_id
    )
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createServiceClient()

    const CRITICAL_ERRORS = ['error', 'challenge_required', 'session_expired']
    const isCriticalError = CRITICAL_ERRORS.includes(status)

    const updateData: any = {
      last_heartbeat: new Date().toISOString(),
      status,
    }

    // 1. Auto-Quarantine Circuit Breaker
    if (isCriticalError) {
      updateData.is_active = false
    }

    // Update account heartbeat
    const { error: updateError } = await supabase
      .from('ig_accounts')
      .update(updateData)
      .eq('id', ig_account_id)

    if (updateError) {
      logger.error('[DM-Agent] Heartbeat update error:', updateError)
    }

    // 2. Webhook Alert
    if (isCriticalError && process.env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 URGENT: IG Account ${ig_account_id} reported a critical error: ${error_detail || status}. The account has been auto-quarantined.`,
          }),
        })
      } catch (err) {
        logger.error('[DM-Agent] Webhook alert failed:', err)
      }
    }

    // Insert heartbeat log
    const { error: insertError } = await supabase
      .from('agent_heartbeats')
      .insert({
        ig_account_id,
        status,
        messages_found: messages_found || 0,
        messages_sent: messages_sent || 0,
        error_detail: error_detail || null,
      })

    if (insertError) {
      logger.error('[DM-Agent] Heartbeat insert error:', insertError)
      return NextResponse.json({ error: 'Failed to log heartbeat' }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (error) {
    logger.error('[DM-Agent] Heartbeat unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
