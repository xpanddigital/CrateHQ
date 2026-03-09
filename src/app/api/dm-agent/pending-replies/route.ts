import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'
import { logger } from '@/lib/logger'

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

    const supabase = createServiceClient()

    // 1. Kill Switch Check
    const { data: account, error: accountError } = await supabase
      .from('ig_accounts')
      .select('is_active')
      .eq('id', igAccountId!)
      .single()

    if (accountError) {
      logger.error('[DM-Agent] Account fetch error:', accountError)
      return NextResponse.json({ error: 'Failed to verify account status' }, { status: 500 })
    }

    if (!account?.is_active) {
      // Emergency Kill Switch activated: Send back empty array so the agent does nothing
      return NextResponse.json({ messages: [] })
    }

    // 2. Fetch pending messages
    const { data: messages, error } = await supabase
      .from('pending_outbound_messages')
      .select('id, ig_thread_id, message_text, target_username, outreach_type')
      .eq('ig_account_id', igAccountId!)
      .eq('status', 'pending')
      .eq('is_approved', true)
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('[DM-Agent] Pending replies error:', error)
      return NextResponse.json({ error: 'Failed to fetch pending messages' }, { status: 500 })
    }

    return NextResponse.json({
      messages: (messages || []).map(m => ({
        id: m.id,
        thread_id: m.ig_thread_id,
        message_text: m.message_text,
        target_username: m.target_username,
        outreach_type: m.outreach_type || 'reply',
      })),
    })
  } catch (error) {
    logger.error('[DM-Agent] Pending replies unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
