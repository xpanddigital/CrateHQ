import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { InstantlyClient } from '@/lib/instantly/client'

export async function POST(request: NextRequest) {
  try {
    // Auth: normal CrateHQ user session
    const userSupabase = await createClient()
    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { artist_id, channel, message_text, scout_id } = body

    if (!artist_id || !channel || !message_text) {
      return NextResponse.json(
        { error: 'Missing required fields: artist_id, channel, message_text' },
        { status: 400 }
      )
    }

    if (!['instagram', 'email'].includes(channel)) {
      return NextResponse.json(
        { error: 'Invalid channel. Must be "instagram" or "email"' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    if (channel === 'instagram') {
      return await handleInstagramSend(supabase, { artist_id, message_text, scout_id: scout_id || user.id })
    } else {
      return await handleEmailSend(supabase, { artist_id, message_text, scout_id: scout_id || user.id })
    }
  } catch (error) {
    console.error('[Messages/Send] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleInstagramSend(
  supabase: any,
  params: { artist_id: string; message_text: string; scout_id: string }
) {
  // Find the most recent inbound IG conversation for this artist to get thread context
  const { data: lastInbound, error: lookupError } = await supabase
    .from('conversations')
    .select('ig_account_id, ig_thread_id')
    .eq('artist_id', params.artist_id)
    .eq('channel', 'instagram')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    console.error('[Messages/Send] IG lookup error:', lookupError)
    return NextResponse.json({ error: 'Failed to look up conversation thread' }, { status: 500 })
  }

  if (!lastInbound || !lastInbound.ig_account_id || !lastInbound.ig_thread_id) {
    return NextResponse.json(
      { error: 'No Instagram conversation thread found for this artist. The artist must message first.' },
      { status: 404 }
    )
  }

  // Queue the outbound message
  const { data: queued, error: queueError } = await supabase
    .from('pending_outbound_messages')
    .insert({
      ig_account_id: lastInbound.ig_account_id,
      ig_thread_id: lastInbound.ig_thread_id,
      message_text: params.message_text,
      scout_id: params.scout_id,
      artist_id: params.artist_id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (queueError) {
    console.error('[Messages/Send] IG queue error:', queueError)
    return NextResponse.json({ error: 'Failed to queue Instagram message' }, { status: 500 })
  }

  return NextResponse.json({
    sent: true,
    channel: 'instagram',
    queued: true,
    pending_message_id: queued.id,
  })
}

async function handleEmailSend(
  supabase: any,
  params: { artist_id: string; message_text: string; scout_id: string }
) {
  // Get artist email
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, name, email')
    .eq('id', params.artist_id)
    .single()

  if (artistError || !artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  if (!artist.email) {
    return NextResponse.json({ error: 'Artist has no email address' }, { status: 400 })
  }

  // Get Instantly API key from integrations
  const { data: integration } = await supabase
    .from('integrations')
    .select('api_key')
    .eq('service', 'instantly')
    .eq('is_active', true)
    .maybeSingle()

  if (!integration?.api_key) {
    return NextResponse.json(
      { error: 'Instantly integration not configured. Add your API key in Settings.' },
      { status: 400 }
    )
  }

  // Send via Instantly V2 reply endpoint
  const instantly = new InstantlyClient(integration.api_key)
  try {
    const res = await fetch('https://api.instantly.ai/api/v2/emails/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.api_key}`,
      },
      body: JSON.stringify({
        reply_to_uuid: null,
        to: artist.email,
        body: params.message_text,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('[Messages/Send] Instantly reply error:', result)
      return NextResponse.json(
        { error: `Instantly API error: ${result?.message || res.statusText}` },
        { status: 502 }
      )
    }

    // Log the outbound email in conversations
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        artist_id: params.artist_id,
        channel: 'email',
        direction: 'outbound',
        message_text: params.message_text,
        sender: params.scout_id,
        external_id: result?.id || null,
        scout_id: params.scout_id,
        metadata: { instantly_response: result },
        read: true,
      })
      .select('id')
      .single()

    return NextResponse.json({
      sent: true,
      channel: 'email',
      conversation_id: conversation?.id || null,
    })
  } catch (fetchError) {
    console.error('[Messages/Send] Instantly fetch error:', fetchError)
    return NextResponse.json({ error: 'Failed to send email via Instantly' }, { status: 502 })
  }
}
