import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateCatalogValue } from '@/lib/valuation/estimator'

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

    const searchParams = request.nextUrl.searchParams
    const stage = searchParams.get('stage')
    const scoutId = searchParams.get('scout_id')

    let query = supabase
      .from('deals')
      .select(`
        *,
        artist:artists(*),
        scout:profiles(*)
      `)
      .order('stage_changed_at', { ascending: false })

    // Scouts only see their own deals
    if (profile?.role === 'scout') {
      query = query.eq('scout_id', user.id)
    } else if (scoutId) {
      // Admin can filter by scout
      query = query.eq('scout_id', scoutId)
    }

    if (stage) {
      query = query.eq('stage', stage)
    }

    const { data: deals, error } = await query

    if (error) throw error

    return NextResponse.json({ deals })
  } catch (error: any) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { artist_id, notes } = body

    // Fetch artist to calculate valuation
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', artist_id)
      .single()

    if (artistError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    // Calculate catalog value
    const valuation = estimateCatalogValue({
      streams_last_month: artist.streams_last_month,
      track_count: artist.track_count,
      spotify_monthly_listeners: artist.spotify_monthly_listeners,
      growth_yoy: artist.growth_yoy,
    })

    // Update artist with valuation if not already set
    if (!artist.estimated_offer) {
      await supabase
        .from('artists')
        .update({
          estimated_offer: valuation.point_estimate,
          estimated_offer_low: valuation.range_low,
          estimated_offer_high: valuation.range_high,
        })
        .eq('id', artist_id)
    }

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        artist_id,
        scout_id: user.id,
        stage: 'new',
        estimated_deal_value: valuation.point_estimate,
        notes,
      })
      .select(`
        *,
        artist:artists(*),
        scout:profiles(*)
      `)
      .single()

    if (dealError) throw dealError

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create deal' },
      { status: 500 }
    )
  }
}
