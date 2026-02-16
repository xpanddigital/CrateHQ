import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyReply, generateReply } from '@/lib/ai/sdr'

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

    const body = await request.json()
    const { channel, direction, subject, body: messageBody } = body

    // Get deal with full data
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        *,
        artist:artists(*),
        scout:profiles(*),
        conversations(*)
      `)
      .eq('id', params.id)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Prepare conversation data
    const conversationData: any = {
      deal_id: params.id,
      artist_id: deal.artist_id,
      scout_id: user.id,
      channel: channel || 'note',
      direction: direction || 'internal',
      subject,
      body: messageBody,
      is_read: direction !== 'inbound',
      requires_human_review: false,
    }

    // If inbound, auto-classify and generate reply
    if (direction === 'inbound') {
      try {
        const classification = await classifyReply(messageBody, deal.conversations)
        conversationData.ai_classification = classification.classification
        conversationData.ai_confidence = classification.urgency === 'high' ? 0.9 : classification.urgency === 'medium' ? 0.7 : 0.5
        conversationData.requires_human_review = true

        // If interested, generate reply draft
        if (classification.classification === 'interested') {
          const reply = await generateReply(
            messageBody,
            deal.artist,
            deal.scout,
            classification,
            deal.conversations
          )
          conversationData.ai_suggested_reply = reply.reply_text
        }
      } catch (aiError) {
        console.error('AI processing error:', aiError)
        // Continue without AI data
      }
    }

    // Create conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single()

    if (error) throw error

    // Update deal timestamps
    if (direction === 'outbound') {
      await supabase
        .from('deals')
        .update({
          last_outreach_at: new Date().toISOString(),
          emails_sent: deal.emails_sent + 1,
        })
        .eq('id', params.id)
    } else if (direction === 'inbound') {
      await supabase
        .from('deals')
        .update({
          last_reply_at: new Date().toISOString(),
        })
        .eq('id', params.id)
    }

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create message' },
      { status: 500 }
    )
  }
}
