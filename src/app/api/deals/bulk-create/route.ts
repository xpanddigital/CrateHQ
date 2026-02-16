import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/deals/bulk-create - Create deals for multiple artists
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artistIds } = await request.json()

    if (!artistIds || !Array.isArray(artistIds) || artistIds.length === 0) {
      return NextResponse.json({ error: 'artistIds array is required' }, { status: 400 })
    }

    // Get artists with their estimated offers
    const { data: artists, error: artistsError } = await supabase
      .from('artists')
      .select('id, name, estimated_offer')
      .in('id', artistIds)

    if (artistsError) throw artistsError

    // Get existing active deals for these artists
    const { data: existingDeals } = await supabase
      .from('deals')
      .select('artist_id')
      .in('artist_id', artistIds)
      .not('stage', 'in', '(closed_won,closed_lost)')

    const existingArtistIds = new Set(existingDeals?.map(d => d.artist_id) || [])

    // Filter out artists that already have active deals
    const artistsToCreate = artists?.filter(a => !existingArtistIds.has(a.id)) || []

    if (artistsToCreate.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: artistIds.length,
        message: 'All selected artists already have active deals'
      })
    }

    // Create deals
    const dealsToInsert = artistsToCreate.map(artist => ({
      artist_id: artist.id,
      scout_id: user.id,
      stage: 'new',
      estimated_deal_value: artist.estimated_offer || null,
    }))

    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .insert(dealsToInsert)
      .select()

    if (dealsError) throw dealsError

    return NextResponse.json({
      created: deals?.length || 0,
      skipped: artistIds.length - artistsToCreate.length,
      deals
    })
  } catch (error: any) {
    console.error('Error bulk creating deals:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk create deals' },
      { status: 500 }
    )
  }
}
