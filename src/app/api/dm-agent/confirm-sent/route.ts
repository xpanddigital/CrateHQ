import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pending_message_id, ig_message_id } = body

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
    const { error: updateError } = await supabase
      .from('pending_outbound_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', pending_message_id)

    if (updateError) {
      console.error('[DM-Agent] Confirm-sent update error:', updateError)
      return NextResponse.json({ error: 'Failed to update message status' }, { status: 500 })
    }

    // Insert outbound conversation record
    const { data: conversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        artist_id: pendingMsg.artist_id || null,
        channel: 'instagram',
        direction: 'outbound',
        message_text: pendingMsg.message_text,
        sender: auth.account.ig_username,
        ig_account_id: pendingMsg.ig_account_id,
        ig_thread_id: pendingMsg.ig_thread_id,
        ig_message_id: ig_message_id || null,
        metadata: { pending_message_id },
        read: true,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[DM-Agent] Confirm-sent insert error:', insertError)
      return NextResponse.json({ error: 'Message marked sent but failed to log conversation' }, { status: 500 })
    }

    return NextResponse.json({
      confirmed: true,
      conversation_id: conversation.id,
    })
  } catch (error) {
    console.error('[DM-Agent] Confirm-sent unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
