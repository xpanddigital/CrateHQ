import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
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
  // ── Step 1: Get artist ──
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

  const artistEmailLower = artist.email.toLowerCase()

  // ── Step 2: Get Instantly API key ──
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
      { error: 'Instantly API key not configured.' },
      { status: 400 }
    )
  }

  // ── Step 3: Get conversation context (subject) ──
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('direction, sender, metadata')
    .eq('artist_id', params.artist_id)
    .eq('channel', 'email')
    .order('created_at', { ascending: false })
    .limit(20)

  let subject = 'Following up'
  let replyToUuid: string | null = null

  for (const convo of recentConvos || []) {
    if (subject === 'Following up' && convo.metadata?.subject) {
      const s = convo.metadata.subject
      subject = s.startsWith('Re:') ? s : `Re: ${s}`
    }
    if (!replyToUuid && convo.metadata?.instantly_uuid) {
      replyToUuid = convo.metadata.instantly_uuid
    }
  }

  // ── Step 4: Determine eaccount (our Instantly sending account) ──
  // The ONLY reliable source is the Instantly accounts API.
  // We fetch the list and pick the right one, excluding the artist's email.
  let eaccount: string | null = null
  let allInstantlyAccounts: string[] = []

  try {
    const accountsRes = await fetch('https://api.instantly.ai/api/v2/accounts?limit=100', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    const accountsRaw = await accountsRes.text()
    console.log(`[Messages/Send] Instantly accounts API ${accountsRes.status}: ${accountsRaw.slice(0, 500)}`)

    if (accountsRes.ok) {
      const accountsData = JSON.parse(accountsRaw)
      const accounts = accountsData.items || accountsData || []
      allInstantlyAccounts = (Array.isArray(accounts) ? accounts : [])
        .map((a: any) => (a.email || a.email_address || '').toLowerCase().trim())
        .filter(Boolean)

      console.log(`[Messages/Send] Instantly accounts: [${allInstantlyAccounts.join(', ')}]`)

      // Prefer the account that was used in prior conversation
      for (const convo of recentConvos || []) {
        const outFrom = convo.direction === 'outbound'
          ? (convo.metadata?.from_email || convo.sender || '').toLowerCase()
          : null
        const inTo = convo.direction === 'inbound'
          ? (convo.metadata?.to_email || '').toLowerCase()
          : null

        const candidate = outFrom || inTo
        if (candidate && candidate !== artistEmailLower && allInstantlyAccounts.includes(candidate)) {
          eaccount = candidate
          break
        }
      }

      // Otherwise pick the first account that isn't the artist
      if (!eaccount) {
        eaccount = allInstantlyAccounts.find(a => a !== artistEmailLower) || null
      }
    }
  } catch (e) {
    console.error('[Messages/Send] Failed to fetch Instantly accounts:', e)
  }

  if (!eaccount) {
    return NextResponse.json(
      { error: `No valid sending account. Instantly accounts: [${allInstantlyAccounts.join(', ')}]. Artist: ${artistEmailLower}` },
      { status: 400 }
    )
  }

  console.log(`[Messages/Send] Using eaccount: ${eaccount}`)

  // ── Step 5: Find reply_to_uuid from Instantly if we don't have one ──
  if (!replyToUuid) {
    try {
      const searchRes = await fetch(
        `https://api.instantly.ai/api/v2/emails?lead=${encodeURIComponent(artist.email)}&limit=5`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      )
      const searchRaw = await searchRes.text()
      console.log(`[Messages/Send] Instantly emails search ${searchRes.status}: ${searchRaw.slice(0, 500)}`)

      if (searchRes.ok) {
        const searchData = JSON.parse(searchRaw)
        const emails = searchData.items || []
        if (Array.isArray(emails) && emails.length > 0) {
          replyToUuid = emails[0].id || null
          console.log(`[Messages/Send] Found reply_to_uuid: ${replyToUuid}, eaccount: ${emails[0].eaccount}, from: ${emails[0].from_address_email}`)
        }
      }
    } catch (e) {
      console.error('[Messages/Send] Instantly email search failed:', e)
    }
  }

  console.log(`[Messages/Send] reply_to_uuid: ${replyToUuid || 'none'}`)

  // ── Step 6: Send via Instantly ──
  let instantlyResult: any = null
  let instantlyError: string | null = null

  try {
    let endpoint: string
    let requestBody: any

    if (replyToUuid) {
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
    } else {
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
    }

    console.log(`[Messages/Send] ${replyToUuid ? 'Replying' : 'Sending new'}: to=${artist.email}, from=${eaccount}, endpoint=${endpoint}`)
    console.log(`[Messages/Send] Request body: ${JSON.stringify(requestBody).slice(0, 500)}`)

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
      console.error(`[Messages/Send] Instantly ${res.status} error:`, JSON.stringify(result))
      instantlyError = result?.message || result?.error || `${res.status} ${res.statusText}`

      // If reply fails with 404 (account not found), retry as new send
      if (res.status === 404 && replyToUuid) {
        console.log('[Messages/Send] Reply failed with 404, retrying as new email send...')
        const retryBody = {
          eaccount,
          subject,
          to_address_email_list: [artist.email],
          body: {
            text: params.message_text,
            html: `<div>${params.message_text.replace(/\n/g, '<br>')}</div>`,
          },
        }
        const retryRes = await fetch('https://api.instantly.ai/api/v2/emails/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(retryBody),
        })
        const retryResult = await retryRes.json()
        if (retryRes.ok) {
          console.log('[Messages/Send] Retry as new send succeeded')
          instantlyResult = retryResult
          instantlyError = null
        } else {
          console.error('[Messages/Send] Retry also failed:', JSON.stringify(retryResult))
          instantlyError = retryResult?.message || retryResult?.error || `${retryRes.status}`
        }
      }
    } else {
      instantlyResult = result
      console.log(`[Messages/Send] Instantly success: ${JSON.stringify(result).slice(0, 300)}`)
    }
  } catch (fetchError) {
    console.error('[Messages/Send] Instantly fetch error:', fetchError)
    instantlyError = String(fetchError)
  }

  // ── Step 7: ALWAYS save to conversations ──
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
    console.error('[Messages/Send] CRITICAL: Conversation insert failed:', convoError)
    return NextResponse.json({
      error: 'Failed to save message to database',
      instantly_error: instantlyError,
      db_error: convoError.message,
    }, { status: 500 })
  }

  console.log(`[Messages/Send] Conversation saved: ${conversation.id}, instantly_sent: ${!instantlyError}`)

  // Return 200 with details — frontend should check instantly_error
  return NextResponse.json({
    sent: true,
    channel: 'email',
    conversation_id: conversation.id,
    instantly_sent: !instantlyError,
    instantly_error: instantlyError,
  })
}
