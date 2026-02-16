import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startActorRun, getRunStatus, getDatasetItems } from '@/lib/apify/client'
import { createSnapshot } from '@/lib/snapshots/create'

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

    // Get all artists with Spotify URLs
    const { data: artists, error: artistsError } = await supabase
      .from('artists')
      .select('id, spotify_url, name')
      .not('spotify_url', 'is', null)

    if (artistsError || !artists) {
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    const urls = artists.map(a => a.spotify_url).filter(Boolean) as string[]

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No artists with Spotify URLs found' }, { status: 400 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })
    }

    // Start core data scraper
    const actorId = 'YZhD6hYc8daYSWXKs'
    const input = { urls }

    const run = await startActorRun(apifyToken, actorId, input)
    const runId = run.data.id

    // Poll for completion
    let attempts = 0
    const maxAttempts = 180 // 15 minutes for large batches

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000))
      
      const status = await getRunStatus(apifyToken, runId)
      
      if (status.data.status === 'SUCCEEDED') {
        const datasetId = status.data.defaultDatasetId
        const items = await getDatasetItems(apifyToken, datasetId)
        
        // Update artists and create snapshots
        let updated = 0
        let failed = 0

        for (const item of items) {
          try {
            const spotifyUrl = item._url || item.url
            const artist = artists.find(a => a.spotify_url === spotifyUrl)
            if (!artist) continue

            const updateData = {
              spotify_monthly_listeners: item.monthlyListeners || 0,
              track_count: item.trackCount || 0,
              instagram_followers: item.instagramFollowers || 0,
              updated_at: new Date().toISOString(),
            }

            // Update artist
            await supabase
              .from('artists')
              .update(updateData)
              .eq('id', artist.id)

            // Create snapshot
            await createSnapshot(artist.id, updateData)

            updated++
          } catch (error) {
            console.error('Error updating artist:', error)
            failed++
          }
        }
        
        return NextResponse.json({
          success: true,
          total: artists.length,
          updated,
          failed,
        })
      }
      
      if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error('Scraping failed')
      }
      
      attempts++
    }

    throw new Error('Scraping timed out')
  } catch (error: any) {
    console.error('Re-scrape error:', error)
    return NextResponse.json(
      { error: error.message || 'Re-scrape failed' },
      { status: 500 }
    )
  }
}
