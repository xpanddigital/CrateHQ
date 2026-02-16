import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/inbox - Get inbox items requiring attention
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const classification = searchParams.get('classification')
    const scout_id = searchParams.get('scout_id')

    // Query conversations requiring attention
    let query = supabase
      .from('conversations')
      .select(`
        *,
        deal:deals!inner(
          id,
          estimated_deal_value,
          scout:profiles!deals_scout_id_fkey(id, full_name, avatar_url)
        ),
        artist:artists!inner(
          id,
          name,
          image_url,
          estimated_offer_low,
          estimated_offer_high
        )
      `)
      .eq('direction', 'inbound')
      .or('requires_human_review.eq.true,is_read.eq.false')
      .order('sent_at', { ascending: false })

    if (classification && classification !== 'all') {
      query = query.eq('ai_classification', classification)
    }

    if (scout_id && scout_id !== 'all') {
      query = query.eq('deal.scout_id', scout_id)
    }

    const { data: items, error } = await query

    if (error) throw error

    return NextResponse.json({ items: items || [] })
  } catch (error: any) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inbox' },
      { status: 500 }
    )
  }
}
