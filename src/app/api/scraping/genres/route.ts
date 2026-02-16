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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { urls } = await request.json()

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })
    }

    const actorId = 'web-scraper/spotify-scraper'
    const input = {
      urls: urls, // Note: Actor expects "urls" array
    }

    const run = await startActorRun(apifyToken, actorId, input)
    const runId = run.data.id

    // Poll for completion
    let attempts = 0
    const maxAttempts = 120

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000))
      
      const status = await getRunStatus(apifyToken, runId)
      
      if (status.data.status === 'SUCCEEDED') {
        const datasetId = status.data.defaultDatasetId
        const items = await getDatasetItems(apifyToken, datasetId)
        
        // Transform and key by Spotify ID
        const results: Record<string, any> = {}
        
        for (const item of items) {
          const spotifyId = extractSpotifyId(item.url || item._url)
          if (!spotifyId) continue
          
          results[spotifyId] = {
            genres: item.genres || [],
            popularity: item.popularity || 0,
          }
        }
        
        return NextResponse.json({ results })
      }
      
      if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error('Genre scraping failed')
      }
      
      attempts++
    }

    throw new Error('Genre scraping timed out')
  } catch (error: any) {
    console.error('Genre scraping error:', error)
    return NextResponse.json(
      { error: error.message || 'Genre scraping failed' },
      { status: 500 }
    )
  }
}

function extractSpotifyId(url: string): string | null {
  const match = url?.match(/artist\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}
