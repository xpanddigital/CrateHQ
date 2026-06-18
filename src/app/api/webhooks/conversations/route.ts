import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getGHLClient } from '@/lib/ghl/client'
import { getContact } from '@/lib/ghl/conversations'
import { logger } from '@/lib/logger'

/**
 * Marketplace webhook receiver — InboundMessage events.
 *
 * Architecture:
 *   - Single webhook subscription registered on the agency-level marketplace
 *     app. Fires for every sub-account where the app is installed; payload's
 *     `locationId` identifies the scout's IG alias.
 *   - We filter to InboundMessage + IG channel only; everything else is ack'd
 *     and ignored.
 *   - For each IG inbound, fetch the contact, extract the IG handle,
 *     match to a CrateHQ artist, store as a conversation, advance any
 *     matching deal from outreach → replied.
 *
 * Auth — Phase 1 (current):
 *   - If `GHL_WEBHOOK_SECRET` env is set, require matching `x-webhook-secret`
 *     header (works only if marketplace lets us configure a custom header).
 *   - If not set, accept all incoming webhooks. URL is sufficiently obscure;
 *     signature verification deferred to Phase 2.
 *
 * Auth — Phase 2 (TODO):
 *   - Verify `x-wh-signature` header against the marketplace's public RSA
 *     key (their default signing model). See:
 *     https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
 */

const OUTREACH_STAGES = ['outreach_queued', 'contacted']

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.GHL_WEBHOOK_SECRET
    if (!expectedSecret) {
      // Mandatory: refuse to start in production without a secret. This
      // closes the loophole where a fresh deploy missed the env var and
      // started accepting all webhook traffic.
      logger.error('[Webhook Inbox] GHL_WEBHOOK_SECRET not configured — refusing all webhooks')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }
    const providedSecret = request.headers.get('x-webhook-secret')
    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const eventType = body.type as string | undefined
    const messageType = body.messageType as string | undefined
    const locationId = body.locationId as string | undefined
    const contactId = body.contactId as string | undefined
    const conversationIdExt = body.conversationId as string | undefined
    const messageId = (body.messageId ?? body.id) as string | undefined
    const messageText = (body.body ?? body.message ?? '') as string
    const dateAdded = body.dateAdded as string | undefined

    // Only process inbound IG messages — everything else is acked + ignored
    if (eventType !== 'InboundMessage') {
      return NextResponse.json({ received: true, ignored: 'event_type', type: eventType })
    }
    if (messageType !== 'IG') {
      return NextResponse.json({ received: true, ignored: 'channel', messageType })
    }

    if (!locationId || !contactId || !messageId) {
      logger.warn('[Webhook Inbox] Missing required fields', {
        hasLocationId: !!locationId,
        hasContactId: !!contactId,
        hasMessageId: !!messageId,
      })
      return NextResponse.json(
        { error: 'Missing required: locationId, contactId, messageId' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Map marketplace location → ig_account (and the tenant it belongs to)
    const { data: igAccount, error: accountError } = await supabase
      .from('ig_accounts')
      .select('id, account_id, assigned_scout_id, is_active')
      .eq('ghl_location_id', locationId)
      .maybeSingle()

    if (accountError) {
      logger.error('[Webhook Inbox] ig_accounts lookup failed:', accountError)
      return NextResponse.json({ error: 'Account lookup failed' }, { status: 500 })
    }

    if (!igAccount) {
      // Not an error — likely a non-CrateHQ sub-account in the same agency
      logger.info('[Webhook Inbox] No ig_account for locationId', { locationId })
      return NextResponse.json({ received: true, ignored: 'unknown_location' })
    }

    // Dedup by external message ID
    const externalId = `inbox_${messageId}`
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        received: true,
        duplicate: true,
        conversation_id: existing.id,
      })
    }

    // Fetch contact to extract IG handle for artist matching
    let igHandle: string | null = null
    let senderName: string | null = null
    const ghlClient = await getGHLClient(supabase, igAccount.id)
    if (ghlClient) {
      const contact = await getContact(ghlClient, contactId)
      if (contact) {
        igHandle = contact.instagramHandle ?? null
        const composedName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
        senderName = contact.fullName ?? (composedName.length > 0 ? composedName : null)
      }
    } else {
      logger.warn('[Webhook Inbox] No client for ig_account (PIT not configured?)', {
        igAccountId: igAccount.id,
      })
    }

    // Match IG handle → artist (case-insensitive), SCOPED to the account that
    // owns this IG account. Without the account_id filter, an inbound DM
    // would be attributed to whichever tenant happens to have the same
    // @handle on file — a cross-tenant leak.
    let artist: { id: string; name: string } | null = null
    if (igHandle && igAccount.account_id) {
      const { data: artistMatch } = await supabase
        .from('artists')
        .select('id, name')
        .eq('account_id', igAccount.account_id)
        .ilike('instagram_handle', igHandle)
        .maybeSingle()
      artist = artistMatch
    }

    // Insert conversation — scoped to the IG account's account_id
    const { data: conversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        account_id: igAccount.account_id,
        artist_id: artist?.id ?? null,
        scout_id: igAccount.assigned_scout_id ?? null,
        channel: 'instagram',
        direction: 'inbound',
        message_text: messageText,
        sender: igHandle ?? senderName ?? `contact_${contactId}`,
        ig_account_id: igAccount.id,
        external_id: externalId,
        metadata: {
          source: 'inbox_webhook',
          ghl_location_id: locationId,
          ghl_contact_id: contactId,
          ghl_conversation_id: conversationIdExt ?? null,
          ghl_message_id: messageId,
          sender_name: senderName,
          date_added: dateAdded ?? null,
          attachments: body.attachments ?? null,
        },
        read: false,
      })
      .select('id')
      .single()

    if (insertError) {
      logger.error('[Webhook Inbox] conversations insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 })
    }

    // Auto-advance matched artist's deals from outreach stages → replied.
    // Scoped to the same account so we don't touch another tenant's deals
    // even if (somehow) the artist_id collision survives the account filter.
    if (artist) {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, stage')
        .eq('account_id', igAccount.account_id)
        .eq('artist_id', artist.id)
        .in('stage', OUTREACH_STAGES)

      if (deals && deals.length > 0) {
        const dealIds = deals.map(d => d.id)
        const { error: stageErr } = await supabase
          .from('deals')
          .update({ stage: 'replied', stage_changed_at: new Date().toISOString() })
          .in('id', dealIds)
        if (stageErr) {
          logger.warn('[Webhook Inbox] deal stage update failed:', stageErr)
        }
      }
    }

    return NextResponse.json({
      received: true,
      conversation_id: conversation.id,
      ig_account_id: igAccount.id,
      artist_matched: !!artist,
      artist_name: artist?.name ?? null,
      ig_handle_extracted: igHandle,
    })
  } catch (error) {
    logger.error('[Webhook Inbox] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
