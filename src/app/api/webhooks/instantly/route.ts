import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const WEBHOOK_SECRET = process.env.INSTANTLY_WEBHOOK_SECRET

/**
 * POST /api/webhooks/instantly
 *
 * Handles Instantly webhook events:
 *   - reply_received: inbound email from lead → create conversation entry
 *   - email_sent: outbound email sent → create conversation entry
 *   - email_opened: lead opened email → update metadata
 *   - email_bounced: email bounced → update metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-secret')
    const providedSecret = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader

    if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const body = await request.json()
    const { event_type, data } = body

    if (!event_type || !data) {
      return NextResponse.json({ error: 'Missing event_type or data' }, { status: 400 })
    }

    const supabase = createServiceClient()

    switch (event_type) {
      case 'reply_received':
        return await handleReplyReceived(supabase, data)
      case 'email_sent':
        return await handleEmailSent(supabase, data)
      case 'email_opened':
        return await handleEmailOpened(supabase, data)
      case 'email_bounced':
        return await handleEmailBounced(supabase, data)
      default:
        return NextResponse.json({ received: true, event_type, handled: false })
    }
  } catch (error) {
    console.error('[Webhook/Instantly] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * reply_received — inbound email reply from a lead/artist
 */
async function handleReplyReceived(supabase: any, data: any) {
  const senderEmail = (data.from_email || data.email || '').toLowerCase().trim()
  const messageText = data.text_body || data.body || data.message || ''
  const subject = data.subject || ''
  const messageId = data.message_id || data.id || null
  const campaignId = data.campaign_id || null
  const timestamp = data.timestamp || data.received_at || new Date().toISOString()

  if (!senderEmail) {
    return NextResponse.json({ error: 'Missing sender email' }, { status: 400 })
  }

  // Dedup by external_id
  if (messageId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('external_id', messageId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  // Match sender to artist (case-insensitive)
  const { data: artist } = await supabase
    .from('artists')
    .select('id, name')
    .ilike('email', senderEmail)
    .maybeSingle()

  // Also try secondary/management emails if primary didn't match
  let matchedArtist = artist
  if (!matchedArtist) {
    const { data: secMatch } = await supabase
      .from('artists')
      .select('id, name')
      .ilike('email_secondary', senderEmail)
      .maybeSingle()
    matchedArtist = secMatch
  }
  if (!matchedArtist) {
    const { data: mgmtMatch } = await supabase
      .from('artists')
      .select('id, name')
      .ilike('email_management', senderEmail)
      .maybeSingle()
    matchedArtist = mgmtMatch
  }

  // Insert conversation
  const { data: conversation, error: insertError } = await supabase
    .from('conversations')
    .insert({
      artist_id: matchedArtist?.id || null,
      channel: 'email',
      direction: 'inbound',
      message_text: messageText,
      sender: senderEmail,
      external_id: messageId,
      metadata: {
        subject,
        campaign_id: campaignId,
        from_email: senderEmail,
        timestamp,
        raw_event: 'reply_received',
      },
      read: false,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[Webhook/Instantly] Reply insert error:', insertError)
    return NextResponse.json({ error: 'Failed to store reply' }, { status: 500 })
  }

  // Update deal stage to 'replied' if artist matched and in outreach stage
  if (matchedArtist) {
    const { data: deals } = await supabase
      .from('deals')
      .select('id, stage')
      .eq('artist_id', matchedArtist.id)
      .in('stage', ['outreach_queued', 'contacted'])

    if (deals && deals.length > 0) {
      await supabase
        .from('deals')
        .update({ stage: 'replied', stage_changed_at: new Date().toISOString() })
        .in('id', deals.map((d: any) => d.id))
    }
  }

  return NextResponse.json({
    received: true,
    event_type: 'reply_received',
    conversation_id: conversation.id,
    artist_matched: !!matchedArtist,
    artist_name: matchedArtist?.name || null,
  })
}

/**
 * email_sent — outbound email was sent by Instantly
 */
async function handleEmailSent(supabase: any, data: any) {
  const toEmail = (data.to_email || data.email || '').toLowerCase().trim()
  const messageText = data.text_body || data.body || data.message || ''
  const subject = data.subject || ''
  const messageId = data.message_id || data.id || null
  const campaignId = data.campaign_id || null

  if (!toEmail) {
    return NextResponse.json({ error: 'Missing recipient email' }, { status: 400 })
  }

  // Dedup
  if (messageId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('external_id', messageId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  // Match recipient to artist
  const { data: artist } = await supabase
    .from('artists')
    .select('id, name')
    .ilike('email', toEmail)
    .maybeSingle()

  const { data: conversation, error: insertError } = await supabase
    .from('conversations')
    .insert({
      artist_id: artist?.id || null,
      channel: 'email',
      direction: 'outbound',
      message_text: messageText,
      sender: data.from_email || null,
      external_id: messageId,
      metadata: {
        subject,
        campaign_id: campaignId,
        to_email: toEmail,
        from_email: data.from_email || null,
        raw_event: 'email_sent',
      },
      read: true,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[Webhook/Instantly] Sent insert error:', insertError)
    return NextResponse.json({ error: 'Failed to store sent email' }, { status: 500 })
  }

  return NextResponse.json({
    received: true,
    event_type: 'email_sent',
    conversation_id: conversation.id,
    artist_matched: !!artist,
  })
}

/**
 * email_opened — lead opened an email
 */
async function handleEmailOpened(supabase: any, data: any) {
  const toEmail = (data.to_email || data.email || '').toLowerCase().trim()
  if (!toEmail) {
    return NextResponse.json({ received: true, handled: false })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id, emails_opened')
    .ilike('email', toEmail)
    .maybeSingle()

  if (artist) {
    await supabase
      .from('artists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', artist.id)

    // Update deal emails_opened count if deal exists
    const { data: deal } = await supabase
      .from('deals')
      .select('id, emails_opened')
      .eq('artist_id', artist.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (deal) {
      await supabase
        .from('deals')
        .update({ emails_opened: (deal.emails_opened || 0) + 1 })
        .eq('id', deal.id)
    }
  }

  return NextResponse.json({
    received: true,
    event_type: 'email_opened',
    artist_matched: !!artist,
  })
}

/**
 * email_bounced — email bounced
 */
async function handleEmailBounced(supabase: any, data: any) {
  const toEmail = (data.to_email || data.email || '').toLowerCase().trim()
  if (!toEmail) {
    return NextResponse.json({ received: true, handled: false })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .ilike('email', toEmail)
    .maybeSingle()

  if (artist) {
    await supabase
      .from('artists')
      .update({
        email_rejected: true,
        email_rejection_reason: `Bounced: ${data.bounce_type || 'unknown'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artist.id)
  }

  return NextResponse.json({
    received: true,
    event_type: 'email_bounced',
    artist_matched: !!artist,
  })
}
