import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // TODO: If direction is inbound, classify with AI
    // For now, we'll skip AI classification

    return NextResponse.json({ conversation })
  } catch (error: any) {
    console.error('Error adding message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add message' },
      { status: 500 }
    )
  }
}
