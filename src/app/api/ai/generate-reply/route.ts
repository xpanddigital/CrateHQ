import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReplyAI } from '@/lib/ai/sdr-claude'
import type { ReplyClassification, ScoutPersona } from '@/lib/ai/sdr'
import { resolveAccountIdForUser } from '@/lib/auth/account'
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// POST /api/ai/generate-reply - Generate AI reply
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(rateLimitKey(user.id, 'ai/generate-reply'), RATE_LIMITS.ai)
    if (!rl.allowed) return rl.response

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

    // Get scout profile for persona + calendly link
    const { data: profile } = await supabase
      .from('profiles')
      .select('ai_sdr_persona, full_name, calendly_link')
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

    const accountId = await resolveAccountIdForUser(supabase, user.id)
    const draft = await generateReplyAI({
      replyText,
      classification: (classification || 'unclear') as ReplyClassification,
      artistName: deal.artist.name,
      artistData: {
        streams_last_month: deal.artist.streams_last_month,
        spotify_monthly_listeners: deal.artist.spotify_monthly_listeners,
        estimated_offer_low: deal.artist.estimated_offer_low,
        estimated_offer_high: deal.artist.estimated_offer_high,
        genres: deal.artist.genres
      },
      conversationHistory,
      scoutPersona,
      scoutCalendlyLink: profile?.calendly_link ?? null,
      scoutName: profile?.full_name ?? null,
      usage: { accountId, userId: user.id },
    })

    return NextResponse.json({ draft })
  } catch (error: any) {
    logger.error('Error generating reply:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate reply' },
      { status: 500 }
    )
  }
}
