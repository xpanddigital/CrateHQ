import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'

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

    // Update account heartbeat
    const { error: updateError } = await supabase
      .from('ig_accounts')
      .update({
        last_heartbeat: new Date().toISOString(),
        status,
      })
      .eq('id', ig_account_id)

    if (updateError) {
      console.error('[DM-Agent] Heartbeat update error:', updateError)
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
      console.error('[DM-Agent] Heartbeat insert error:', insertError)
      return NextResponse.json({ error: 'Failed to log heartbeat' }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('[DM-Agent] Heartbeat unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
