import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'

const OUTREACH_STAGES = ['outreach_queued', 'contacted']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      ig_account_id,
      thread_id,
      sender_username,
      sender_full_name,
      message_text,
      message_id,
      timestamp,
      item_type,
    } = body

    if (!ig_account_id || !thread_id || !sender_username || !message_text || !message_id) {
      return NextResponse.json(
        { error: 'Missing required fields: ig_account_id, thread_id, sender_username, message_text, message_id' },
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

    // Dedup check
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('ig_message_id', message_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Match sender to artist (case-insensitive)
    const handleLower = sender_username.toLowerCase()
    const { data: artist } = await supabase
      .from('artists')
      .select('id, name')
      .ilike('instagram_handle', handleLower)
      .maybeSingle()

    // Insert conversation
    const { data: conversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        artist_id: artist?.id || null,
        channel: 'instagram',
        direction: 'inbound',
        message_text,
        sender: sender_username,
        ig_account_id,
        ig_thread_id: thread_id,
        ig_message_id: message_id,
        metadata: {
          sender_full_name: sender_full_name || null,
          timestamp: timestamp || null,
          item_type: item_type || 'text',
        },
        read: false,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Webhook IG-DM] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 })
    }

    // If artist matched and they have a deal in an outreach stage, update to 'replied'
    if (artist) {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, stage')
        .eq('artist_id', artist.id)
        .in('stage', OUTREACH_STAGES)

      if (deals && deals.length > 0) {
        const dealIds = deals.map(d => d.id)
        await supabase
          .from('deals')
          .update({ stage: 'replied', stage_changed_at: new Date().toISOString() })
          .in('id', dealIds)
      }
    }

    return NextResponse.json({
      received: true,
      conversation_id: conversation.id,
      artist_matched: !!artist,
      artist_name: artist?.name || null,
    })
  } catch (error) {
    console.error('[Webhook IG-DM] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
