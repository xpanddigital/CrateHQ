import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateCatalogValue } from '@/lib/valuation/estimator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artistIds, all, revalueAll } = await request.json()

    let artists: any[] = []

    if (all) {
      if (revalueAll) {
        // Get ALL artists (revalue everything)
        const { data, error } = await supabase
          .from('artists')
          .select('*')

        if (error) throw error
        artists = data || []
      } else {
        // Get only artists without valuation
        const { data, error } = await supabase
          .from('artists')
          .select('*')
          .is('estimated_offer', null)

        if (error) throw error
        artists = data || []
      }
    } else if (artistIds && Array.isArray(artistIds)) {
      // Get specific artists
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .in('id', artistIds)

      if (error) throw error
      artists = data || []
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const results = []
    let valuated = 0
    let skipped = 0

    for (const artist of artists) {
      try {
        // Skip if no streaming data at all
        if (!artist.streams_last_month && !artist.spotify_monthly_listeners) {
          skipped++
          continue
        }

        const valuation = estimateCatalogValue({
          streams_last_month: artist.streams_last_month || 0,
          track_count: artist.track_count,
          spotify_monthly_listeners: artist.spotify_monthly_listeners,
          instagram_followers: artist.instagram_followers,
          growth_yoy: artist.growth_yoy,
        })

        // Update artist
        const { error: updateError } = await supabase
          .from('artists')
          .update({
            estimated_offer: valuation.point_estimate,
            estimated_offer_low: valuation.range_low,
            estimated_offer_high: valuation.range_high,
            updated_at: new Date().toISOString(),
          })
          .eq('id', artist.id)

        if (updateError) throw updateError

        valuated++
        results.push({
          artist_id: artist.id,
          artist_name: artist.name,
          valuation: valuation.display_range,
          qualifies: valuation.qualifies,
        })
      } catch (error) {
        console.error(`Error valuating artist ${artist.id}:`, error)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      total: artists.length,
      valuated,
      skipped,
      results,
    })
  } catch (error: any) {
    console.error('Error bulk valuating:', error)
    return NextResponse.json(
      { error: error.message || 'Bulk valuation failed' },
      { status: 500 }
    )
  }
}
