import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startActorRun, getRunStatus, getDatasetItems } from '@/lib/apify/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { actorId, keywords, playlistUrls, maxResults } = await request.json()

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Apify token not configured' },
        { status: 500 }
      )
    }

    // Prepare input for Apify actor
    const input: any = {
      maxResults: maxResults || 50,
    }

    if (keywords && keywords.length > 0) {
      input.searchQueries = keywords
    }

    if (playlistUrls && playlistUrls.length > 0) {
      input.playlistUrls = playlistUrls
    }

    // Start the Apify actor run
    const run = await startActorRun(apifyToken, actorId, input)

    return NextResponse.json({
      runId: run.data.id,
      status: run.data.status,
    })
  } catch (error: any) {
    console.error('Error starting Apify scrape:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start scraping' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const runId = searchParams.get('runId')

    if (!runId) {
      return NextResponse.json({ error: 'Run ID required' }, { status: 400 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Apify token not configured' },
        { status: 500 }
      )
    }

    // Get run status
    const runStatus = await getRunStatus(apifyToken, runId)
    const status = runStatus.data.status

    if (status === 'SUCCEEDED') {
      // Fetch the results
      const datasetId = runStatus.data.defaultDatasetId
      const items = await getDatasetItems(apifyToken, datasetId)

      // Transform Apify results to our artist format
      const artists = items.map((item: any) => ({
        name: item.name || item.artistName || item.title,
        spotify_url: item.url || item.spotifyUrl,
        spotify_monthly_listeners: item.monthlyListeners || item.listeners || 0,
        image_url: item.image || item.imageUrl,
        genres: item.genres || [],
      }))

      return NextResponse.json({
        status,
        results: artists,
      })
    }

    return NextResponse.json({
      status,
      results: [],
    })
  } catch (error: any) {
    console.error('Error fetching Apify results:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch results' },
      { status: 500 }
    )
  }
}
