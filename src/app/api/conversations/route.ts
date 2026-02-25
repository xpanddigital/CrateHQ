import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/conversations
 *
 * Returns conversation threads grouped by artist (or sender for unmatched).
 * Query params:
 *   - artist_id: fetch thread for a specific artist
 *   - thread_key: fetch thread by ig_thread_id (for unmatched conversations)
 *   - channel: filter by channel
 *   - unread_only: only show unread inbound
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const artistId = params.get('artist_id')
    const threadKey = params.get('thread_key')
    const channel = params.get('channel')
    const unreadOnly = params.get('unread_only') === 'true'

    // Single thread by artist_id
    if (artistId && artistId !== 'null') {
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: true })

      if (channel && channel !== 'all') {
        query = query.eq('channel', channel)
      }

      const { data: messages, error } = await query
      if (error) {
        console.error('[Conversations] Thread fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 })
      }

      const { data: artist } = await supabase
        .from('artists')
        .select(`
          id, name, image_url, spotify_monthly_listeners, streams_last_month,
          track_count, instagram_handle, website, email, youtube_url,
          estimated_offer_low, estimated_offer_high, qualification_status,
          qualification_reason, booking_agency, management_company
        `)
        .eq('id', artistId)
        .single()

      const { data: deal } = await supabase
        .from('deals')
        .select('id, stage, scout_id')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({ messages, artist, deal })
    }

    // Single thread by ig_thread_id or sender (unmatched conversations)
    if (threadKey && threadKey !== 'null') {
      // Could be an ig_thread_id or a sender email — try both
      let messages: any[] = []

      const { data: igMessages, error: igErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('ig_thread_id', threadKey)
        .order('created_at', { ascending: true })

      if (!igErr && igMessages && igMessages.length > 0) {
        messages = igMessages
      } else {
        // Try matching by sender (for unmatched email conversations)
        const { data: senderMessages, error: senderErr } = await supabase
          .from('conversations')
          .select('*')
          .or(`sender.ilike.${threadKey},metadata->>from_email.ilike.${threadKey}`)
          .order('created_at', { ascending: true })

        if (!senderErr && senderMessages) {
          messages = senderMessages
        }
      }

      return NextResponse.json({ messages, artist: null, deal: null })
    }

    // Thread list: aggregate conversations
    let query = supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel)
    }

    if (unreadOnly) {
      query = query.eq('read', false).eq('direction', 'inbound')
    }

    const { data: allMessages, error } = await query
    if (error) {
      console.error('[Conversations] List fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Group by artist_id when available, otherwise by ig_thread_id or sender
    const threadMap = new Map<string, {
      artist_id: string | null
      thread_key: string | null
      sender_name: string | null
      last_message: any
      last_inbound_at: string | null
      unread_count: number
      channels: Set<string>
    }>()

    for (const msg of allMessages || []) {
      const key = msg.artist_id || msg.ig_thread_id || msg.sender || msg.id
      const existing = threadMap.get(key)

      if (!existing) {
        threadMap.set(key, {
          artist_id: msg.artist_id,
          thread_key: msg.ig_thread_id || msg.sender || null,
          sender_name: msg.sender,
          last_message: msg,
          last_inbound_at: msg.direction === 'inbound' ? msg.created_at : null,
          unread_count: (!msg.read && msg.direction === 'inbound') ? 1 : 0,
          channels: new Set([msg.channel]),
        })
      } else {
        existing.channels.add(msg.channel)
        if (!msg.read && msg.direction === 'inbound') {
          existing.unread_count++
        }
        if (msg.direction === 'inbound' && (!existing.last_inbound_at || msg.created_at > existing.last_inbound_at)) {
          existing.last_inbound_at = msg.created_at
        }
      }
    }

    // Fetch artist details for matched threads
    const artistIds = Array.from(threadMap.values())
      .map(t => t.artist_id)
      .filter(Boolean) as string[]

    let artistMap: Record<string, any> = {}
    if (artistIds.length > 0) {
      const { data: artists } = await supabase
        .from('artists')
        .select('id, name, image_url, instagram_handle, email')
        .in('id', artistIds)

      for (const a of artists || []) {
        artistMap[a.id] = a
      }
    }

    // Fetch deals for pipeline stage
    let dealMap: Record<string, any> = {}
    if (artistIds.length > 0) {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, artist_id, stage, scout_id')
        .in('artist_id', artistIds)

      for (const d of deals || []) {
        if (!dealMap[d.artist_id]) {
          dealMap[d.artist_id] = d
        }
      }
    }

    // Build thread list sorted by most recent inbound first
    const threads = Array.from(threadMap.values())
      .sort((a, b) => {
        const aTime = a.last_inbound_at || a.last_message.created_at
        const bTime = b.last_inbound_at || b.last_message.created_at
        return bTime.localeCompare(aTime)
      })
      .map(t => ({
        artist_id: t.artist_id,
        thread_key: t.thread_key,
        sender_name: t.sender_name,
        artist: t.artist_id ? (artistMap[t.artist_id] || null) : null,
        deal: t.artist_id ? (dealMap[t.artist_id] || null) : null,
        last_message: {
          text: t.last_message.message_text,
          channel: t.last_message.channel,
          direction: t.last_message.direction,
          created_at: t.last_message.created_at,
          sender: t.last_message.sender,
        },
        unread_count: t.unread_count,
        channels: Array.from(t.channels),
      }))

    return NextResponse.json({ threads })
  } catch (error) {
    console.error('[Conversations] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/conversations — mark messages as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { artist_id, thread_key } = body

    if (!artist_id && !thread_key) {
      return NextResponse.json({ error: 'Missing artist_id or thread_key' }, { status: 400 })
    }

    let query = supabase
      .from('conversations')
      .update({ read: true })

    if (artist_id) {
      query = query.eq('artist_id', artist_id)
    } else if (thread_key) {
      // thread_key could be ig_thread_id or sender email
      query = query.or(`ig_thread_id.eq.${thread_key},sender.ilike.${thread_key}`)
    }

    const { error } = await query.eq('read', false)

    if (error) {
      console.error('[Conversations] Mark read error:', error)
      return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Conversations] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
