import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Fetch conversations that need review
    let query = supabase
      .from('conversations')
      .select(`
        *,
        deal:deals(
          *,
          artist:artists(*),
          scout:profiles(*),
          conversations(*)
        )
      `)
      .or('requires_human_review.eq.true,and(direction.eq.inbound,is_read.eq.false)')
      .order('sent_at', { ascending: false })

    const { data: conversations, error } = await query

    if (error) throw error

    // Filter by scout if not admin
    let filtered = conversations || []
    if (profile?.role === 'scout') {
      filtered = filtered.filter((c: any) => c.deal?.scout_id === user.id)
    }

    // Transform to include full deal data
    const items = filtered.map((c: any) => ({
      conversation: {
        id: c.id,
        deal_id: c.deal_id,
        artist_id: c.artist_id,
        scout_id: c.scout_id,
        channel: c.channel,
        direction: c.direction,
        subject: c.subject,
        body: c.body,
        ai_classification: c.ai_classification,
        ai_confidence: c.ai_confidence,
        ai_suggested_reply: c.ai_suggested_reply,
        is_read: c.is_read,
        requires_human_review: c.requires_human_review,
        sent_at: c.sent_at,
        created_at: c.created_at,
      },
      deal: c.deal,
    }))

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inbox' },
      { status: 500 }
    )
  }
}
