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

  // Find conversation context: subject and our sending account
  // Look at recent conversations to determine the correct eaccount
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('direction, metadata')
    .eq('artist_id', params.artist_id)
    .eq('channel', 'email')
    .order('created_at', { ascending: false })
    .limit(10)

  let subject = 'Following up'
  let sendingAccount: string | null = null

  for (const convo of recentConvos || []) {
    // Get subject from any conversation
    if (subject === 'Following up' && convo.metadata?.subject) {
      const s = convo.metadata.subject
      subject = s.startsWith('Re:') ? s : `Re: ${s}`
    }

    // For sending account: outbound from_email is always our account
    if (!sendingAccount && convo.direction === 'outbound' && convo.metadata?.from_email) {
      sendingAccount = convo.metadata.from_email
    }

    // For inbound messages, to_email is our account (the one the lead replied to)
    if (!sendingAccount && convo.direction === 'inbound' && convo.metadata?.to_email) {
      sendingAccount = convo.metadata.to_email
    }
  }

  // If we still don't have a sending account, the inbound webhook may not have
  // stored to_email. Try to get it from Instantly's email accounts API.
  let eaccount = sendingAccount
  if (!eaccount) {
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

  console.log(`[Messages/Send] Resolved eaccount: ${eaccount} (from ${sendingAccount ? 'conversation history' : 'Instantly API'})`)

  let instantlyResult: any = null
  let instantlyError: string | null = null

  // Resolve reply_to_uuid from conversation history
  let replyToUuid: string | null = null
  for (const convo of recentConvos || []) {
    if (convo.metadata?.instantly_uuid) {
      replyToUuid = convo.metadata.instantly_uuid
      break
    }
  }

  if (!replyToUuid) {
    // Last resort: search Instantly API for emails involving this artist
    try {
      const searchRes = await fetch(
        `https://api.instantly.ai/api/v2/emails?search=${encodeURIComponent(artist.email)}&limit=1`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      )
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        const emails = searchData.data || searchData.items || searchData || []
        if (Array.isArray(emails) && emails.length > 0) {
          replyToUuid = emails[0].id || emails[0].uuid || null
          console.log(`[Messages/Send] Found Instantly UUID from search: ${replyToUuid}`)
        }
      }
    } catch (e) {
      console.error('[Messages/Send] Instantly email search failed:', e)
    }
  }

  try {
    let endpoint: string
    let requestBody: any

    if (replyToUuid) {
      // Reply to existing thread
      endpoint = 'https://api.instantly.ai/api/v2/emails/reply'
      requestBody = {
        reply_to_uuid: replyToUuid,
        eaccount,
        subject,
        to_address_email_list: artist.email,
        body: {
          text: params.message_text,
          html: `<div>${params.message_text.replace(/\n/g, '<br>')}</div>`,
        },
      }
      console.log(`[Messages/Send] Replying via Instantly: to=${artist.email}, from=${eaccount}, uuid=${replyToUuid}`)
    } else {
      // No existing thread — send as a new email
      endpoint = 'https://api.instantly.ai/api/v2/emails/send'
      requestBody = {
        eaccount,
        subject,
        to_address_email_list: [artist.email],
        body: {
          text: params.message_text,
          html: `<div>${params.message_text.replace(/\n/g, '<br>')}</div>`,
        },
      }
      console.log(`[Messages/Send] Sending new email via Instantly: to=${artist.email}, from=${eaccount}`)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('[Messages/Send] Instantly error:', JSON.stringify(result))
      instantlyError = result?.message || result?.error || res.statusText
    } else {
      instantlyResult = result
    }
  } catch (fetchError) {
    console.error('[Messages/Send] Instantly fetch error:', fetchError)
    instantlyError = String(fetchError)
  }

  // Save to conversations regardless of Instantly success
  const { data: conversation, error: convoError } = await supabase
    .from('conversations')
    .insert({
      artist_id: params.artist_id,
      channel: 'email',
      direction: 'outbound',
      message_text: params.message_text,
      sender: eaccount,
      external_id: instantlyResult?.id || null,
      scout_id: params.scout_id,
      metadata: {
        subject,
        to_email: artist.email,
        from_email: eaccount,
        instantly_uuid: instantlyResult?.id || null,
        instantly_error: instantlyError,
        instantly_sent: !instantlyError,
        raw_event: 'manual_send',
      },
      read: true,
    })
    .select('id')
    .single()

  if (convoError) {
    console.error('[Messages/Send] Conversation insert error:', convoError)
  }

  return NextResponse.json({
    sent: true,
    channel: 'email',
    conversation_id: conversation?.id || null,
    instantly_id: instantlyResult?.id || null,
    instantly_error: instantlyError,
  })
}
