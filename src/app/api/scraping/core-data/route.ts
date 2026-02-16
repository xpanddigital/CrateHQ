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

    const actorId = 'beatanalytics/spotify-play-count-scraper'
    const input = {
      urls: urls, // Note: Actor expects "urls" array
    }

    const run = await startActorRun(apifyToken, actorId, input)
    const runId = run.data.id

    // Poll for completion
    let attempts = 0
    const maxAttempts = 120 // 10 minutes

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000))
      
      const status = await getRunStatus(apifyToken, runId)
      
      if (status.data.status === 'SUCCEEDED') {
        const datasetId = status.data.defaultDatasetId
        const items = await getDatasetItems(apifyToken, datasetId)
        
        // Transform and key by Spotify ID
        const results: Record<string, any> = {}
        
        for (const item of items) {
          const spotifyId = extractSpotifyId(item._url || item.url)
          if (!spotifyId) continue
          
          // Build social_links
          const socialLinks: Record<string, string> = {}
          for (let i = 0; i < 20; i++) {
            const label = item[`externalLinks/${i}/label`]
            const url = item[`externalLinks/${i}/url`]
            if (label && url) {
              const key = label.toLowerCase().replace(/\s+/g, '_')
              socialLinks[key] = url
            }
          }
          
          // Extract Instagram handle
          let instagramHandle = ''
          if (socialLinks.instagram) {
            instagramHandle = socialLinks.instagram
              .replace(/https?:\/\/(www\.)?instagram\.com\//gi, '')
              .replace(/\/$/, '')
              .split('/')[0]
          }
          
          // Count tracks
          let trackCount = 0
          for (let i = 0; i < 100; i++) {
            if (item[`albums/${i}/id`]) trackCount++
            if (item[`singles/${i}/id`]) trackCount++
          }
          
          // Sum top track streams
          let topTrackStreams = 0
          for (let i = 0; i < 10; i++) {
            const streams = item[`topTracks/${i}/streamCount`]
            if (streams) topTrackStreams += parseInt(streams) || 0
          }
          
          results[spotifyId] = {
            name: item.name,
            _url: item._url || item.url,
            monthlyListeners: item.monthlyListeners || 0,
            followers: item.followers || 0,
            biography: item.biography || null,
            social_links: socialLinks,
            instagram_handle: instagramHandle || null,
            trackCount,
            topTrackStreams,
            image_url: item['coverArt/0/url'] || null,
            country: item['topCities/0/country'] || null,
            verified: item.verified || false,
            worldRank: item.worldRank || null,
          }
        }
        
        return NextResponse.json({ results })
      }
      
      if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error('Scraping failed')
      }
      
      attempts++
    }

    throw new Error('Scraping timed out')
  } catch (error: any) {
    console.error('Core data error:', error)
    return NextResponse.json(
      { error: error.message || 'Core data scraping failed' },
      { status: 500 }
    )
  }
}

function extractSpotifyId(url: string): string | null {
  const match = url?.match(/artist\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}
