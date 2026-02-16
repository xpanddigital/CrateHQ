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

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { keywords, maxResults } = await request.json()

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })
    }

    // Start discovery scraper
    const actorId = 'scrapearchitect/spotify-artist-scraper'
    const input = {
      searchTerms: keywords, // Note: Actor expects "searchTerms" not "searchQueries"
      maxResults: maxResults || 50,
    }

    const run = await startActorRun(apifyToken, actorId, input)
    const runId = run.data.id

    // Poll for completion
    let attempts = 0
    const maxAttempts = 60

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000))
      
      const status = await getRunStatus(apifyToken, runId)
      
      if (status.data.status === 'SUCCEEDED') {
        const datasetId = status.data.defaultDatasetId
        const items = await getDatasetItems(apifyToken, datasetId)
        
        // Extract artist URLs
        const urls = items
          .map((item: any) => item.url || item.artistUrl || item.spotifyUrl)
          .filter(Boolean)
        
        return NextResponse.json({ urls })
      }
      
      if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error('Scraping failed')
      }
      
      attempts++
    }

    throw new Error('Scraping timed out')
  } catch (error: any) {
    console.error('Discovery error:', error)
    return NextResponse.json(
      { error: error.message || 'Discovery failed' },
      { status: 500 }
    )
  }
}
