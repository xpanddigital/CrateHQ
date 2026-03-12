import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startActorRun } from '@/lib/apify/client'
import { logger } from '@/lib/logger'

const DEFAULT_ACTOR_ID = 'YZhD6hYc8daYSWXKs' // beatanalytics/spotify-play-count-scraper

/**
 * POST /api/scraping/core-data
 * Triggers an Apify run for core artist data. Returns immediately with { runId, datasetId }.
 * Client polls /api/scraping/status?runId=xxx, then fetches /api/scraping/results?datasetId=xxx.
 */
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

    const { urls, actorId } = await request.json()
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })

    // beatanalytics scraper expects { urls: [{url: "..."}], followAlbums, ... }
    const input = {
      urls: urls.map((url: string) => ({ url })),
      followAlbums: true,
      followPopularReleases: true,
      followSingles: true,
    }

    const run = await startActorRun(apifyToken, actorId || DEFAULT_ACTOR_ID, input)

    return NextResponse.json({
      runId: run.data.id,
      datasetId: run.data.defaultDatasetId,
    })
  } catch (error: any) {
    logger.error('[Scraping/CoreData] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to start run' }, { status: 500 })
  }
}
