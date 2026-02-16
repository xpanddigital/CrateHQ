import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReply, ReplyClassification, ScoutPersona } from '@/lib/ai/sdr'

// POST /api/ai/generate-reply - Generate AI reply
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { replyText, artistId, dealId, classification } = await request.json()

    if (!replyText || !dealId) {
      return NextResponse.json(
        { error: 'replyText and dealId are required' },
        { status: 400 }
      )
    }

    // Get deal with artist data and conversations
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        *,
        artist:artists(*),
        conversations(direction, body, sent_at)
      `)
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Get scout profile for persona
    const { data: profile } = await supabase
      .from('profiles')
      .select('ai_sdr_persona')
      .eq('id', user.id)
      .single()

    const scoutPersona = (profile?.ai_sdr_persona || 'professional') as ScoutPersona

    // Sort conversations by date
    const conversationHistory = (deal.conversations || [])
      .sort((a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
      .map((c: any) => ({
        direction: c.direction,
        body: c.body
      }))

    const draft = generateReply({
      replyText,
      classification: classification || 'unclear',
      artistName: deal.artist.name,
      artistData: {
        streams_last_month: deal.artist.streams_last_month,
        spotify_monthly_listeners: deal.artist.spotify_monthly_listeners,
        estimated_offer_low: deal.artist.estimated_offer_low,
        estimated_offer_high: deal.artist.estimated_offer_high,
        genres: deal.artist.genres
      },
      conversationHistory,
      scoutPersona
    })

    return NextResponse.json({ draft })
  } catch (error: any) {
    console.error('Error generating reply:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate reply' },
      { status: 500 }
    )
  }
}
