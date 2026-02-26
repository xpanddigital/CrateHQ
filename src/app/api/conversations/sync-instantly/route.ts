import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/conversations/sync-instantly
 *
 * Fetches email history from Instantly's Unibox for a given artist email
 * and backfills any missing conversations (outbound campaign emails, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { artist_id } = body

    if (!artist_id) {
      return NextResponse.json({ error: 'Missing artist_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get artist email
    const { data: artist } = await supabase
      .from('artists')
      .select('id, name, email, email_secondary, email_management')
      .eq('id', artist_id)
      .single()

    if (!artist?.email) {
      return NextResponse.json({ error: 'Artist has no email' }, { status: 400 })
    }

    // Get Instantly API key
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
      return NextResponse.json({ error: 'Instantly API key not configured' }, { status: 400 })
    }

    // Fetch emails from Instantly Unibox for this lead
    const emailsToCheck = [artist.email, artist.email_secondary, artist.email_management].filter(Boolean)
    let allEmails: any[] = []

    for (const email of emailsToCheck) {
      try {
        const res = await fetch(
          `https://api.instantly.ai/api/v2/emails?lead=${encodeURIComponent(email!)}&limit=50`,
          {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          }
        )

        if (res.ok) {
          const data = await res.json()
          const emails = data.items || []
          allEmails.push(...(Array.isArray(emails) ? emails : []))
        }
      } catch (e) {
        console.error(`[Sync] Failed to fetch Instantly emails for ${email}:`, e)
      }
    }

    if (allEmails.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No emails found in Instantly' })
    }

    // Get existing conversation external_ids to avoid duplicates
    const { data: existingConvos } = await supabase
      .from('conversations')
      .select('external_id')
      .eq('artist_id', artist_id)
      .eq('channel', 'email')

    const existingIds = new Set((existingConvos || []).map(c => c.external_id).filter(Boolean))

    let synced = 0

    for (const email of allEmails) {
      const instantlyId = email.id || email.message_id
      const dedupKey = `instantly_sync_${instantlyId}`

      if (existingIds.has(dedupKey) || existingIds.has(instantlyId)) {
        continue
      }

      const fromEmail = (email.from_address_email || '').toLowerCase()
      const toEmails = (email.to_address_email_list || '').toLowerCase()
      const artistEmailLower = artist.email!.toLowerCase()

      // Determine direction
      const isInbound = fromEmail === artistEmailLower ||
        fromEmail === (artist.email_secondary || '').toLowerCase() ||
        fromEmail === (artist.email_management || '').toLowerCase()
      const direction = isInbound ? 'inbound' : 'outbound'

      const messageText = email.body?.text || email.body?.html?.replace(/<[^>]+>/g, '') || ''
      const subject = email.subject || ''
      const timestamp = email.timestamp_email || email.timestamp_created || new Date().toISOString()

      const { error: insertError } = await supabase
        .from('conversations')
        .insert({
          artist_id,
          channel: 'email',
          direction,
          message_text: messageText.trim(),
          sender: isInbound ? fromEmail : (email.eaccount || fromEmail),
          external_id: dedupKey,
          metadata: {
            subject,
            from_email: fromEmail,
            to_email: toEmails,
            instantly_uuid: instantlyId,
            synced_from_instantly: true,
            timestamp,
          },
          read: true,
          created_at: timestamp,
        })

      if (!insertError) {
        synced++
        existingIds.add(dedupKey)
      } else {
        console.error(`[Sync] Insert error for ${instantlyId}:`, insertError.message)
      }
    }

    return NextResponse.json({
      synced,
      total_found: allEmails.length,
      artist_name: artist.name,
    })
  } catch (error) {
    console.error('[Sync/Instantly] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
