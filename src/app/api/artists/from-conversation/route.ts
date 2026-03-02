import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/artists/from-conversation
 *
 * Create an artist from an unmatched conversation (e.g. Instagram DM thread)
 * and backfill artist_id onto all conversations in that thread.
 *
 * Body:
 *   - thread_key: string (required) — ig_thread_id (for Instagram) or sender email
 *   - name?: string
 *   - instagram_handle?: string
 *   - email?: string
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { thread_key, name, instagram_handle, email } = body || {}

    if (!thread_key || typeof thread_key !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: thread_key' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 1) Find the most recent inbound Instagram conversation for this thread
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('id, channel, direction, artist_id, sender, ig_thread_id, metadata')
      .eq('ig_thread_id', thread_key)
      .eq('channel', 'instagram')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (convoError) {
      console.error('[Artists/FromConversation] Fetch conversation error:', convoError)
      return NextResponse.json({ error: 'Failed to look up conversation' }, { status: 500 })
    }

    if (!convo) {
      return NextResponse.json(
        { error: 'No inbound Instagram conversation found for this thread_key' },
        { status: 404 }
      )
    }

    if (convo.artist_id) {
      // Already linked
      return NextResponse.json({
        message: 'Conversation already linked to an artist',
        artist_id: convo.artist_id,
      })
    }

    const inferredName =
      name ||
      (convo.metadata as any)?.sender_full_name ||
      convo.sender ||
      'Unknown'

    const inferredHandle =
      instagram_handle ||
      convo.sender ||
      null

    // 2) Create the artist record
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .insert({
        name: inferredName,
        instagram_handle: inferredHandle,
        email: email || null,
        source: 'manual',
      })
      .select('id, name, image_url, instagram_handle, email')
      .single()

    if (artistError || !artist) {
      console.error('[Artists/FromConversation] Artist insert error:', artistError)
      return NextResponse.json({ error: 'Failed to create artist' }, { status: 500 })
    }

    // 3) Backfill artist_id on all conversations in this IG thread
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ artist_id: artist.id })
      .eq('ig_thread_id', thread_key)

    if (updateError) {
      console.error('[Artists/FromConversation] Backfill conversations error:', updateError)
      // Non-fatal for the artist creation, but report to caller
      return NextResponse.json({
        artist,
        warning: 'Artist created but failed to link all conversations to artist',
      })
    }

    return NextResponse.json({ artist })
  } catch (error: any) {
    console.error('[Artists/FromConversation] Unhandled error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

