import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/deals - Create new deal
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artist_id } = await request.json()

    if (!artist_id) {
      return NextResponse.json({ error: 'artist_id is required' }, { status: 400 })
    }

    // Check if artist exists and get estimated offer
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, name, estimated_offer')
      .eq('id', artist_id)
      .single()

    if (artistError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    // Check for existing active deal
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('artist_id', artist_id)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .single()

    if (existingDeal) {
      return NextResponse.json(
        { error: 'An active deal already exists for this artist' },
        { status: 409 }
      )
    }

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        artist_id,
        scout_id: user.id,
        stage: 'new',
        estimated_deal_value: artist.estimated_offer || null,
      })
      .select()
      .single()

    if (dealError) throw dealError

    return NextResponse.json({ deal })
  } catch (error: any) {
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create deal' },
      { status: 500 }
    )
  }
}

// GET /api/deals - List deals with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const stage = searchParams.get('stage')
    const scout_id = searchParams.get('scout_id')
    const search = searchParams.get('search')

    let query = supabase
      .from('deals')
      .select(`
        *,
        artist:artists(id, name, image_url, spotify_monthly_listeners, estimated_offer_low, estimated_offer_high),
        scout:profiles(id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (stage) {
      query = query.eq('stage', stage)
    }

    if (scout_id) {
      query = query.eq('scout_id', scout_id)
    }

    const { data: deals, error } = await query

    if (error) throw error

    // Filter by artist name if search provided
    let filteredDeals = deals || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredDeals = filteredDeals.filter((deal: any) =>
        deal.artist?.name?.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({ deals: filteredDeals })
  } catch (error: any) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}
