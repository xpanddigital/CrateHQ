import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyReply } from '@/lib/ai/sdr'

// POST /api/deals/[id]/message - Add message to conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channel, direction, body, subject } = await request.json()

    if (!channel || !direction || !body) {
      return NextResponse.json(
        { error: 'channel, direction, and body are required' },
        { status: 400 }
      )
    }

    // Get deal to get artist_id
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('artist_id, scout_id')
      .eq('id', params.id)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Auto-classify inbound messages
    let aiClassification = null
    let aiConfidence = null
    let requiresHumanReview = false

    if (direction === 'inbound') {
      // Get conversation history for context
      const { data: history } = await supabase
        .from('conversations')
        .select('direction, body')
        .eq('deal_id', params.id)
        .order('sent_at', { ascending: true })

      const conversationHistory = history || []
      const classification = classifyReply(body, conversationHistory)

      aiClassification = classification.classification
      aiConfidence = classification.confidence

      // Set requires_human_review for interested or question classifications
      if (aiClassification === 'interested' || aiClassification === 'question') {
        requiresHumanReview = true
      }
    }

    // Create conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        deal_id: params.id,
        artist_id: deal.artist_id,
        scout_id: user.id,
        channel,
        direction,
        subject: subject || null,
        body,
        ai_classification: aiClassification,
        ai_confidence: aiConfidence,
        requires_human_review: requiresHumanReview,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (convError) throw convError

    // Update deal's last_outreach_at if outbound
    if (direction === 'outbound') {
      await supabase
        .from('deals')
        .update({
          last_outreach_at: new Date().toISOString(),
          emails_sent: supabase.rpc('increment', { x: 1 }),
        })
        .eq('id', params.id)
    }

    return NextResponse.json({ conversation })
  } catch (error: any) {
    console.error('Error adding message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add message' },
      { status: 500 }
    )
  }
}
