import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startActorRun } from '@/lib/apify/client'
import { logger } from '@/lib/logger'

const ACTOR_ID = 'YZhD6hYc8daYSWXKs' // beatanalytics/spotify-play-count-scraper

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { data: artists, error: artistsError } = await supabase
      .from('artists').select('id, spotify_url, name').not('spotify_url', 'is', null)

    if (artistsError || !artists) {
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    const urls = artists.map(a => a.spotify_url).filter(Boolean) as string[]
    if (urls.length === 0) {
      return NextResponse.json({ error: 'No artists with Spotify URLs found' }, { status: 400 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })

    const input = {
      urls: urls.map(url => ({ url })),
      followAlbums: false,
      followPopularReleases: false,
      followSingles: false,
    }

    const run = await startActorRun(apifyToken, ACTOR_ID, input)
    return NextResponse.json({ runId: run.data.id, datasetId: run.data.defaultDatasetId, total: urls.length })
  } catch (error: any) {
    logger.error('[Scraping/RescrapeAll] Error:', error)
    return NextResponse.json({ error: error.message || 'Re-scrape failed' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { items } = await request.json()
    if (!Array.isArray(items)) return NextResponse.json({ error: 'items array required' }, { status: 400 })

    const { data: artists } = await supabase
      .from('artists').select('id, spotify_url').not('spotify_url', 'is', null)

    const urlToId = new Map(artists?.map(a => [a.spotify_url, a.id]) || [])

    let updated = 0, failed = 0

    for (const item of items) {
      const spotifyUrl = item._url || item.url
      const artistId = urlToId.get(spotifyUrl)
      if (!artistId) continue

      try {
        const topTrackStreams = (item.topTracks || [])
          .reduce((sum: number, t: any) => sum + (t.streamCount || 0), 0)

        const { error } = await supabase
          .from('artists')
          .update({
            spotify_monthly_listeners: item.monthlyListeners ?? 0,
            spotify_followers: item.followers ?? 0,
            spotify_verified: item.verified ?? false,
            total_top_track_streams: topTrackStreams,
            world_rank: item.worldRank ?? 0,
            image_url: item.coverArt?.[0]?.url ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', artistId)

        if (error) throw error
        updated++
      } catch (err) {
        logger.error(`[Scraping/RescrapeAll] Failed to update artist ${artistId}:`, err)
        failed++
      }
    }

    return NextResponse.json({ updated, failed, total: items.length })
  } catch (error: any) {
    logger.error('[Scraping/RescrapeAll] Apply error:', error)
    return NextResponse.json({ error: error.message || 'Apply failed' }, { status: 500 })
  }
}
