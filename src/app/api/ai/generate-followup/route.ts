import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFollowup, ScoutPersona } from '@/lib/ai/sdr'

// POST /api/ai/generate-followup - Generate follow-up message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dealId } = await request.json()

    if (!dealId) {
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
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

    // Calculate days since last contact
    const lastContact = deal.last_outreach_at || deal.created_at
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Sort conversations by date
    const conversationHistory = (deal.conversations || [])
      .sort((a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
      .map((c: any) => ({
        direction: c.direction,
        body: c.body
      }))

    const { subject, body } = generateFollowup({
      artistName: deal.artist.name,
      daysSinceContact,
      conversationHistory,
      artistData: {
        streams_last_month: deal.artist.streams_last_month,
        spotify_monthly_listeners: deal.artist.spotify_monthly_listeners,
        estimated_offer_low: deal.artist.estimated_offer_low,
        estimated_offer_high: deal.artist.estimated_offer_high
      },
      scoutPersona
    })

    return NextResponse.json({ subject, body, daysSinceContact })
  } catch (error: any) {
    console.error('Error generating followup:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate followup' },
      { status: 500 }
    )
  }
}
