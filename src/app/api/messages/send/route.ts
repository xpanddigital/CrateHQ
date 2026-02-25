import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Get Instantly API key: prefer env var, fall back to integrations table
  let apiKey = process.env.INSTANTLY_API_KEY || ''
  if (!apiKey) {
    const { data: integration } = await supabase
      .from('integrations')
      .select('api_key')
      .eq('service', 'instantly')
      .eq('is_active', true)
      .maybeSingle()
    apiKey = integration?.api_key || ''
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Instantly API key not configured. Set INSTANTLY_API_KEY env var or add in Settings.' },
      { status: 400 }
    )
  }

  // Find the most recent conversation for context (subject, sending account)
  const { data: lastConvo } = await supabase
    .from('conversations')
    .select('external_id, metadata')
    .eq('artist_id', params.artist_id)
    .eq('channel', 'email')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const subject = lastConvo?.metadata?.subject
    ? (lastConvo.metadata.subject.startsWith('Re:') ? lastConvo.metadata.subject : `Re: ${lastConvo.metadata.subject}`)
    : 'Following up'
  const sendingAccount = lastConvo?.metadata?.from_email || lastConvo?.metadata?.to_email || null

  // First, try to find a valid Instantly eaccount
  let eaccount = sendingAccount
  if (!eaccount) {
    // Try to get the first email account from Instantly
    try {
      const accountsRes = await fetch('https://api.instantly.ai/api/v2/emails/accounts', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json()
        const accounts = accountsData.items || accountsData || []
        if (accounts.length > 0) {
          eaccount = accounts[0].email || accounts[0].email_address
        }
      }
    } catch (e) {
      console.error('[Messages/Send] Failed to fetch Instantly accounts:', e)
    }
  }

  if (!eaccount) {
    return NextResponse.json(
      { error: 'No sending email account found. Configure an email account in Instantly.' },
      { status: 400 }
    )
  }

  try {
    const requestBody: any = {
      eaccount,
      subject,
      to_address_email_list: artist.email,
      body: {
        text: params.message_text,
        html: `<div>${params.message_text.replace(/\n/g, '<br>')}</div>`,
      },
    }

    // If we have a reply_to UUID from Instantly, include it
    if (lastConvo?.metadata?.instantly_uuid) {
      requestBody.reply_to_uuid = lastConvo.metadata.instantly_uuid
    }

    console.log(`[Messages/Send] Sending via Instantly: to=${artist.email}, from=${eaccount}, subject=${subject}`)

    const res = await fetch('https://api.instantly.ai/api/v2/emails/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('[Messages/Send] Instantly reply error:', JSON.stringify(result))
      return NextResponse.json(
        { error: `Instantly API error: ${result?.message || result?.error || res.statusText}` },
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
        sender: eaccount,
        external_id: result?.id || null,
        scout_id: params.scout_id,
        metadata: {
          subject,
          to_email: artist.email,
          from_email: eaccount,
          instantly_uuid: result?.id || null,
          instantly_response: result,
          raw_event: 'manual_send',
        },
        read: true,
      })
      .select('id')
      .single()

    return NextResponse.json({
      sent: true,
      channel: 'email',
      conversation_id: conversation?.id || null,
      instantly_id: result?.id || null,
    })
  } catch (fetchError) {
    console.error('[Messages/Send] Instantly fetch error:', fetchError)
    return NextResponse.json({ error: 'Failed to send email via Instantly' }, { status: 502 })
  }
}
