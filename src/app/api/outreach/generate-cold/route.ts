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
      .select('name, instagram_handle, biography, spotify_monthly_listeners, genres, estimated_offer_low, estimated_offer_high')
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
You are a music industry scout reaching out to independent artists on Instagram about a back catalogue licensing and distribution deal. Your job is to write a highly personalized, casual Instagram DM that feels like a real person typed it on their phone.

TARGET DATA:
Artist Name: ${artist.name || 'the artist'}
Genres: ${(artist.genres || []).join(', ') || 'N/A'}
Spotify Listeners: ${artist.spotify_monthly_listeners || 'N/A'}
Bio/Recent Notes: ${artist.biography || 'N/A'}
Estimated Offer Low: ${artist.estimated_offer_low ? `$${Math.round(artist.estimated_offer_low / 1000)}k` : 'N/A'}
Estimated Offer High: ${artist.estimated_offer_high ? `$${Math.round(artist.estimated_offer_high / 1000)}k` : 'N/A'}

YOUR OFFER:
You want to offer them a short-term digital distribution deal for their existing back catalogue. This does NOT require them to make any new music. Based on their streaming data you can potentially offer them somewhere around ${artist.estimated_offer_low ? `$${Math.round(artist.estimated_offer_low / 1000)}k` : 'N/A'} to ${artist.estimated_offer_high ? `$${Math.round(artist.estimated_offer_high / 1000)}k` : 'N/A'} USD.

MESSAGE STRUCTURE (follow this order):
1. Open with genuine enthusiasm about their music. Reference a specific detail from their bio, a track name, or their streaming numbers. Use exclamation marks naturally like a real fan would.
2. Pivot to the offer. Mention you'd love to offer them a short-term digital distribution deal for their back catalogue and casually drop the dollar range. Frame it as approximate, like "something around $28k-$68k" or "probably somewhere around $28-68k". Round the numbers to the nearest thousand and use the "k" shorthand like a human would. This is the most important part of the message. The money is what gets the reply.
3. End with a simple low-friction ask. Something like "let me know if you're interested" or "open to a quick chat?" Keep it short.

STRICT RULES (FAILURE TO FOLLOW WILL RESULT IN PENALTY):
- No Em Dashes or Semicolons: Absolutely ZERO use of "—" or ";". Use commas or periods only.
- Banned Words: Never use: delve, testament, tapestry, robust, thrilled, greetings, cheers, exciting, incredible, journey, craft, resonate, landscape, opportunity, partnership.
- Banned Phrases: Never use: "caught my eye", "building something real", "love to connect", "on my radar". These are overused AI patterns.
- Length: 3 to 5 short sentences maximum. Do NOT write a wall of text.
- No Robot Speak: No formal greetings or sign-offs. Start with "Hey ${artist.name || 'there'}!" or "Hey ${artist.name || 'there'}!!" with natural enthusiasm.
- Exclamation Marks: Use them freely and naturally like a real person who is genuinely excited. Multiple exclamation marks are fine (!! or !!!).
- Punctuation: Keep it slightly messy. Lowercase where a human would be lazy. A missing period at the end is preferred.
- Dollar Amounts: Always use the "k" shorthand. Write "$29k" not "$29,000" and "$68k" not "$68,800". Round to the nearest thousand. This is how humans text about money.
- Contractions: Always use contractions. Prefer casual forms like "id love" or "we'd love" or "can probably".
- DO NOT sound like a corporate pitch. Sound like a real person who found their music, loves it, and has a genuine financial offer for them.
- The dollar range MUST appear in every message. It is the hook that gets replies.
- Each message must be completely unique. Never reuse the same sentence structure across different artists.

EXAMPLE TONE (do not copy these, just match the energy):
"Hey Maria!! just found your stuff and honestly love your sound!! we do short term distribution deals for back catalogues and based on your numbers I could probably offer something around $29k-$69k USD without needing any new music from you. let me know if you're interested"

"Hey Jake! been listening to your tracks all morning your production is crazy!! would love to offer you a short term deal for your back catalogue, can probably do something around $44k-$85k for your existing music, no new tracks needed. open to a quick chat this week?"
`.trim()

    const resp = await client.messages.create({
      model: 'claude-3-opus-20240229', // Fallback to actual Claude 3 Opus model. 'claude-opus-4-6' does not exist yet.
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
