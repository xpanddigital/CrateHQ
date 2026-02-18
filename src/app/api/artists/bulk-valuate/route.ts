import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateCatalogValue } from '@/lib/valuation/estimator'

const PAGE_SIZE = 500
const PARALLEL_CHUNK = 50

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artistIds, all, revalueAll, offset = 0, limit = PAGE_SIZE } = await request.json()

    let artists: any[] = []
    let totalCount = 0

    if (all) {
      // First get total count
      const countQuery = supabase.from('artists').select('id', { count: 'exact', head: true })
      if (!revalueAll) {
        countQuery.or('estimated_offer.is.null,estimated_offer.eq.0')
      }
      const { count } = await countQuery
      totalCount = count || 0

      // Fetch one page
      const dataQuery = supabase
        .from('artists')
        .select('id, name, streams_last_month, streams_estimated, spotify_monthly_listeners, track_count, instagram_followers, growth_yoy')
        .range(offset, offset + limit - 1)
        .order('id')

      if (!revalueAll) {
        dataQuery.or('estimated_offer.is.null,estimated_offer.eq.0')
      }

      const { data, error } = await dataQuery
      if (error) throw error
      artists = data || []
    } else if (artistIds && Array.isArray(artistIds)) {
      totalCount = artistIds.length
      const { data, error } = await supabase
        .from('artists')
        .select('id, name, streams_last_month, streams_estimated, spotify_monthly_listeners, track_count, instagram_followers, growth_yoy')
        .in('id', artistIds)

      if (error) throw error
      artists = data || []
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    let valuated = 0
    let skipped = 0

    // Compute all valuations in memory (pure math)
    const updates: Array<{ id: string; payload: Record<string, any> }> = []

    for (const artist of artists) {
      if (!artist.streams_last_month && !artist.spotify_monthly_listeners) {
        skipped++
        continue
      }

      let streamsForValuation = artist.streams_last_month || 0
      let streamsEstimated = artist.streams_estimated || false

      if (streamsForValuation <= 0 && artist.spotify_monthly_listeners > 0) {
        streamsForValuation = Math.round(artist.spotify_monthly_listeners * 3.5)
        streamsEstimated = true
      }

      const valuation = estimateCatalogValue({
        streams_last_month: streamsForValuation,
        track_count: artist.track_count,
        spotify_monthly_listeners: artist.spotify_monthly_listeners,
        instagram_followers: artist.instagram_followers,
        growth_yoy: artist.growth_yoy,
      })

      const payload: Record<string, any> = {
        estimated_offer: valuation.point_estimate,
        estimated_offer_low: valuation.range_low,
        estimated_offer_high: valuation.range_high,
        updated_at: new Date().toISOString(),
      }

      if (streamsEstimated && !artist.streams_last_month) {
        payload.streams_last_month = streamsForValuation
        payload.streams_estimated = true
      }

      updates.push({ id: artist.id, payload })
      valuated++
    }

    // Batch DB updates in parallel chunks
    for (let i = 0; i < updates.length; i += PARALLEL_CHUNK) {
      const chunk = updates.slice(i, i + PARALLEL_CHUNK)
      await Promise.all(
        chunk.map(({ id, payload }) =>
          supabase.from('artists').update(payload).eq('id', id)
        )
      )
    }

    const hasMore = all && (offset + limit) < totalCount

    return NextResponse.json({
      success: true,
      total: totalCount,
      processed: artists.length,
      valuated,
      skipped,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    })
  } catch (error: any) {
    console.error('Error bulk valuating:', error)
    return NextResponse.json(
      { error: error.message || 'Bulk valuation failed' },
      { status: 500 }
    )
  }
}
