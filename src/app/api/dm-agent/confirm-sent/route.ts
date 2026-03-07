import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pending_message_id, ig_message_id, ig_thread_id } = body

    if (!pending_message_id) {
      return NextResponse.json(
        { error: 'Missing required field: pending_message_id' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Fetch the pending message to get ig_account_id for auth
    const { data: pendingMsg, error: fetchError } = await supabase
      .from('pending_outbound_messages')
      .select('*')
      .eq('id', pending_message_id)
      .single()

    if (fetchError || !pendingMsg) {
      return NextResponse.json({ error: 'Pending message not found' }, { status: 404 })
    }

    const auth = await verifyAgentAuth(
      request.headers.get('authorization'),
      pendingMsg.ig_account_id
    )
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    // Mark as sent
    const updatePayload: any = { status: 'sent', sent_at: new Date().toISOString() }
    if (ig_thread_id) {
      updatePayload.ig_thread_id = ig_thread_id
    }

    const { error: updateError } = await supabase
      .from('pending_outbound_messages')
      .update(updatePayload)
      .eq('id', pending_message_id)

    if (updateError) {
      console.error('[DM-Agent] Confirm-sent update error:', updateError)
      return NextResponse.json({ error: 'Failed to update message status' }, { status: 500 })
    }

    // Update outbound conversation record
    const convoUpdatePayload: any = {
      ig_message_id: ig_message_id || null,
    }
    if (ig_thread_id) {
      convoUpdatePayload.ig_thread_id = ig_thread_id
    }

    const { data: conversationRows, error: convoError } = await supabase
      .from('conversations')
      .update(convoUpdatePayload)
      .eq('metadata->>pending_message_id', pending_message_id)
      .select('id')

    if (convoError) {
      console.error('[DM-Agent] Confirm-sent convo update error:', convoError)
      return NextResponse.json({ error: 'Message marked sent but failed to update conversation' }, { status: 500 })
    }

    return NextResponse.json({
      confirmed: true,
      conversation_id: conversationRows?.[0]?.id,
    })
  } catch (error) {
    console.error('[DM-Agent] Confirm-sent unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
