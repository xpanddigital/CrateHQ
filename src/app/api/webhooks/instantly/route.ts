import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/webhooks/instantly
 *
 * Instantly sends a flat JSON payload (no nested "data" object).
 * Key fields: event_type, lead_email, email, reply_text, campaign_id, etc.
 *
 * Reply events: event_type = "lead_interested" or "reply_received"
 * Sent events: event_type = "email_sent"
 * Open events: event_type = "email_opened"
 * Bounce events: event_type = "email_bounced"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Instantly sends event_type at the top level
    const eventType = body.event_type
    if (!eventType) {
      console.error('[Webhook/Instantly] No event_type in payload:', JSON.stringify(body).slice(0, 500))
      return NextResponse.json({ error: 'Missing event_type' }, { status: 400 })
    }

    console.log(`[Webhook/Instantly] Received event: ${eventType}, lead: ${body.lead_email || body.email || 'unknown'}`)

    const supabase = createServiceClient()

    // Reply events (Instantly uses "lead_interested" for replies)
    if (eventType === 'lead_interested' || eventType === 'reply_received' || eventType === 'reply') {
      return await handleReply(supabase, body)
    }

    if (eventType === 'email_sent' || eventType === 'sent') {
      return await handleEmailSent(supabase, body)
    }

    if (eventType === 'email_opened' || eventType === 'opened') {
      return await handleEmailOpened(supabase, body)
    }

    if (eventType === 'email_bounced' || eventType === 'bounced' || eventType === 'bounce') {
      return await handleEmailBounced(supabase, body)
    }

    // Unknown event — accept it but don't process
    return NextResponse.json({ received: true, event_type: eventType, handled: false })
  } catch (error) {
    console.error('[Webhook/Instantly] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Handle inbound reply from a lead/artist
 */
async function handleReply(supabase: any, body: any) {
  const senderEmail = (body.lead_email || body.email || body.from_email || '').toLowerCase().trim()
  const replyText = body.reply_text_snippet || body.reply_text || body.text_body || body.body || ''
  const subject = body.reply_subject || body.subject || ''
  const campaignId = body.campaign_id || null
  const campaignName = body.campaign_name || null
  const timestamp = body.timestamp || new Date().toISOString()

  // Extract our sending account from available fields
  // Instantly may provide it as to_email, from_address_email, or in the reply text
  let ourAccount = (body.to_email || body.from_address_email || body.eaccount || '').toLowerCase().trim()
  if (!ourAccount && body.reply_text) {
    // Try to extract from quoted "On ... <email> wrote:" pattern
    const match = body.reply_text.match(/<([^>]+@[^>]+)>\s*wrote:/)
    if (match) {
      ourAccount = match[1].toLowerCase().trim()
    }
  }

  // Build a stable dedup key from available fields
  const dedupKey = `instantly_${senderEmail}_${timestamp}`

  if (!senderEmail) {
    console.error('[Webhook/Instantly] Reply missing sender email:', JSON.stringify(body).slice(0, 500))
    return NextResponse.json({ error: 'Missing sender email' }, { status: 400 })
  }

  // Dedup check
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('external_id', dedupKey)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Match sender to artist (check primary, secondary, management emails)
  let matchedArtist = null

  const { data: primaryMatch } = await supabase
    .from('artists')
    .select('id, name')
    .ilike('email', senderEmail)
    .maybeSingle()
  matchedArtist = primaryMatch

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

  // Strip quoted reply text (everything after "On ... wrote:")
  const cleanReply = replyText
    .replace(/On .+wrote:\n?>[\s\S]*/m, '')
    .replace(/------[\s\S]*$/m, '')
    .trim()

  // Insert conversation
  const { data: conversation, error: insertError } = await supabase
    .from('conversations')
    .insert({
      artist_id: matchedArtist?.id || null,
      channel: 'email',
      direction: 'inbound',
      message_text: cleanReply || replyText,
      sender: senderEmail,
      external_id: dedupKey,
      metadata: {
        subject,
        campaign_id: campaignId,
        campaign_name: campaignName,
        from_email: senderEmail,
        to_email: ourAccount || null,
        timestamp,
        event_type: body.event_type,
        full_reply: replyText,
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

  console.log(`[Webhook/Instantly] Reply stored: ${conversation.id}, artist: ${matchedArtist?.name || 'unmatched'}, from: ${senderEmail}`)

  return NextResponse.json({
    received: true,
    event_type: body.event_type,
    conversation_id: conversation.id,
    artist_matched: !!matchedArtist,
    artist_name: matchedArtist?.name || null,
  })
}

/**
 * Handle outbound email sent by Instantly
 */
async function handleEmailSent(supabase: any, body: any) {
  const toEmail = (body.lead_email || body.email || body.to_email || '').toLowerCase().trim()
  const messageText = body.email_body || body.text_body || body.body || ''
  const subject = body.subject || ''
  const campaignId = body.campaign_id || null
  const timestamp = body.timestamp || new Date().toISOString()
  const dedupKey = `instantly_sent_${toEmail}_${timestamp}`

  if (!toEmail) {
    return NextResponse.json({ received: true, handled: false })
  }

  // Dedup
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('external_id', dedupKey)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

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
      sender: body.from_email || body.from || null,
      external_id: dedupKey,
      metadata: {
        subject,
        campaign_id: campaignId,
        to_email: toEmail,
        event_type: body.event_type,
        step: body.step || null,
        variant: body.variant || null,
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
    event_type: body.event_type,
    conversation_id: conversation.id,
    artist_matched: !!artist,
  })
}

/**
 * Handle email opened event
 */
async function handleEmailOpened(supabase: any, body: any) {
  const toEmail = (body.lead_email || body.email || '').toLowerCase().trim()
  if (!toEmail) {
    return NextResponse.json({ received: true, handled: false })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .ilike('email', toEmail)
    .maybeSingle()

  if (artist) {
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

  return NextResponse.json({ received: true, event_type: body.event_type, artist_matched: !!artist })
}

/**
 * Handle email bounced event
 */
async function handleEmailBounced(supabase: any, body: any) {
  const toEmail = (body.lead_email || body.email || '').toLowerCase().trim()
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
        email_rejection_reason: `Bounced: ${body.bounce_type || 'unknown'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artist.id)
  }

  return NextResponse.json({ received: true, event_type: body.event_type, artist_matched: !!artist })
}
