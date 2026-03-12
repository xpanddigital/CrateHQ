import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startActorRun } from '@/lib/apify/client'
import { logger } from '@/lib/logger'

/**
 * POST /api/scraping/discover
 * Optional sub-step: triggers the custom Spotify Playlist Artist Scraper
 * to discover artist URLs from keywords. Returns { runId, datasetId }.
 * Primary Step 1 flow is local (paste/upload URLs) — this is for keyword discovery only.
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

    const { keywords, maxResults, actorId } = await request.json()

    if (!actorId) {
      return NextResponse.json(
        { error: 'actorId is required for keyword discovery. Set it in Settings → Apify Configuration.' },
        { status: 400 }
      )
    }

    if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
      return NextResponse.json({ error: 'keywords are required' }, { status: 400 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })

    const keywordList = Array.isArray(keywords)
      ? keywords
      : keywords.split(',').map((k: string) => k.trim()).filter(Boolean)

    const input = {
      keywords: keywordList,
      maxResults: maxResults || 50,
    }

    const run = await startActorRun(apifyToken, actorId, input)

    return NextResponse.json({
      runId: run.data.id,
      datasetId: run.data.defaultDatasetId,
    })
  } catch (error: any) {
    logger.error('[Scraping/Discover] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to start run' }, { status: 500 })
  }
}
