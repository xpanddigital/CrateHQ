import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artist_id, ig_account_id, scout_id } = body

    if (!artist_id || !ig_account_id || !scout_id) {
      return NextResponse.json(
        { error: 'Missing required fields: artist_id, ig_account_id, scout_id' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 1. Fetch artist data
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('name, instagram_handle, biography, spotify_monthly_listeners, genres')
      .eq('id', artist_id)
      .single()

    if (artistError || !artist) {
      console.error('[Generate Cold DM] Artist fetch error:', artistError)
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    if (!artist.instagram_handle) {
      return NextResponse.json(
        { error: 'Artist does not have an Instagram handle on file.' },
        { status: 400 }
      )
    }

    // 2. AI Generation
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const prompt = `
You are a real A&R scout writing a cold Instagram DM to an artist to break the ice about a potential catalog or advance deal.

Artist Name: ${artist.name || 'the artist'}
Bio: ${artist.biography || 'N/A'}
Spotify Monthly Listeners: ${artist.spotify_monthly_listeners || 'N/A'}
Genres: ${(artist.genres || []).join(', ') || 'N/A'}

Write a short, punchy, highly personalized Instagram DM icebreaker.

CONSTRAINTS:
- Keep it under 3 sentences.
- Reference a specific detail from their bio, genres, or their monthly listeners to prove you actually looked them up.
- It must sound like a real A&R scout wrote it casually on their phone.
- No robotic greetings like "Dear Artist" or "Hi [Name]".
- DO NOT use any hashtags.
- Do not include any filler text, just return the exact message to send.
`.trim()

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6', // standard model for the app
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const generatedMessage = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : ''

    if (!generatedMessage) {
      throw new Error('AI returned empty message')
    }

    // 3. Queue Insertion
    const { data: pendingMsg, error: insertError } = await supabase
      .from('pending_outbound_messages')
      .insert({
        ig_account_id,
        scout_id,
        artist_id,
        target_username: artist.instagram_handle,
        outreach_type: 'cold',
        status: 'pending',
        message_text: generatedMessage,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Generate Cold DM] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to queue the cold DM' },
        { status: 500 }
      )
    }

    // 4. Return success
    return NextResponse.json({
      message_text: generatedMessage,
      pending_message_id: pendingMsg.id,
    })
  } catch (error: any) {
    console.error('[Generate Cold DM] Unhandled error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
