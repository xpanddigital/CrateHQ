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

    // 0. Check Ramp-Up Limits
    const { data: accountData, error: accountError } = await supabase
      .from('ig_accounts')
      .select('daily_cold_dm_limit')
      .eq('id', ig_account_id)
      .single()

    if (accountError && accountError.code !== 'PGRST116' && accountError.code !== '42703') {
      console.error('[Generate Cold DM] Account fetch error:', accountError)
      return NextResponse.json({ error: 'Failed to fetch account limits' }, { status: 500 })
    }

    // Default to 3 if column is missing or account not found
    const dailyLimit = accountData?.daily_cold_dm_limit ?? 3

    // Calculate midnight of current day (UTC)
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { count: todayCount, error: countError } = await supabase
      .from('pending_outbound_messages')
      .select('*', { count: 'exact', head: true })
      .eq('ig_account_id', ig_account_id)
      .eq('outreach_type', 'cold')
      .gte('created_at', startOfDay.toISOString())

    if (countError) {
      console.error('[Generate Cold DM] Count error:', countError)
      return NextResponse.json({ error: 'Failed to verify daily limit' }, { status: 500 })
    }

    if ((todayCount ?? 0) >= dailyLimit) {
      return NextResponse.json(
        { error: 'Daily cold DM limit reached for this account. Account is currently in the warm-up phase.' },
        { status: 429 }
      )
    }

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
SYSTEM INSTRUCTIONS FOR CLAUDE OPUS 4.6:
You are an A&R scout for a modern music agency. Your job is to write a highly personalized, ultra-casual Instagram DM to an independent artist.

TARGET DATA:
Artist Name: ${artist.name || 'the artist'}
Genres: ${(artist.genres || []).join(', ') || 'N/A'}
Spotify Listeners: ${artist.spotify_monthly_listeners || 'N/A'}
Bio/Recent Notes: ${artist.biography || 'N/A'}

STRICT RULES (FAILURE TO FOLLOW WILL RESULT IN PENALTY):
1. No Em Dashes or Semicolons: Absolutely ZERO use of "—" or ";". Humans typing fast on a phone keyboard almost never use these. Use simple commas or periods.
2. Banned Words: Do not use words like: delve, testament, tapestry, robust, thrilled, greetings, or cheers.
3. Length: Absolute maximum of 3 sentences. Shorter is better.
4. No Robot Speak: DO NOT use formal greetings or sign-offs. Start casually with "Yo ${artist.name || 'there'}," "Hey," or just jump straight into it.
5. The Hook: Reference a specific data point from their Target Data.
6. The Ask: End with a low-friction, casual question. (e.g., "Are you fully independent right now?" or "You working on any new drops this month?")
7. Punctuation: Keep it slightly messy. A missing period at the end of the final sentence is actually preferred.
`.trim()

    const resp = await client.messages.create({
      model: 'claude-opus-4-6', // standard model for the app
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
        is_approved: false, // Must be approved by admin before dispatch
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
