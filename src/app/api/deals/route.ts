import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

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
    logger.error('Error creating deal:', error)
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    const searchParams = request.nextUrl.searchParams
    const stage = searchParams.get('stage')
    const scout_id = searchParams.get('scout_id')
    const search = searchParams.get('search')

    // Use !inner join when searching so PostgREST filters on the joined table
    const selectClause = search
      ? `*, artist:artists!inner(id, name, image_url, spotify_monthly_listeners, estimated_offer_low, estimated_offer_high), scout:profiles(id, full_name, avatar_url)`
      : `*, artist:artists(id, name, image_url, spotify_monthly_listeners, estimated_offer_low, estimated_offer_high), scout:profiles(id, full_name, avatar_url)`

    let query = supabase
      .from('deals')
      .select(selectClause)
      .order('created_at', { ascending: false })

    if (stage) {
      query = query.eq('stage', stage)
    }

    // Scouts can only see their own deals; admins can see all (or filter by scout_id)
    if (!isAdmin) {
      query = query.eq('scout_id', user.id)
    } else if (scout_id) {
      query = query.eq('scout_id', scout_id)
    }

    // Server-side search by artist name via PostgREST join filter
    if (search) {
      query = query.ilike('artist.name', `%${search}%`)
    }

    const { data: deals, error } = await query

    if (error) throw error

    return NextResponse.json({ deals: deals || [] })
  } catch (error: any) {
    logger.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}
