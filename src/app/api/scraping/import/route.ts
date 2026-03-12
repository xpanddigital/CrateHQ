import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * POST /api/scraping/import
 * Bulk upsert scraped artists into the artists table.
 * Deduplicates by spotify_url. Applies optional tags.
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

    const { artists, tagIds } = await request.json()
    if (!artists || !Array.isArray(artists)) {
      return NextResponse.json({ error: 'Invalid artists data' }, { status: 400 })
    }

    // Check existing to track duplicates (don't block upsert — just count skipped)
    const spotifyUrls = artists.map((a: any) => a.spotify_url).filter(Boolean)
    const { data: existing } = await supabase
      .from('artists')
      .select('spotify_url')
      .in('spotify_url', spotifyUrls)

    const existingUrls = new Set(existing?.map(a => a.spotify_url) || [])

    const today = new Date().toISOString().split('T')[0]

    // Transform scraped data → artists table columns
    // Uses real nested field names from beatanalytics/spotify-play-count-scraper output
    const artistsToInsert = artists
      .filter((a: any) => !existingUrls.has(a.spotify_url) && a.spotify_url)
      .map((a: any) => {
        // Extract Spotify ID from URL
        const spotifyIdMatch = a.spotify_url?.match(/artist\/([a-zA-Z0-9]+)/)
        const spotifyId = spotifyIdMatch ? spotifyIdMatch[1] : null

        return {
          name: a.name,
          spotify_url: a.spotify_url,
          spotify_id: spotifyId,
          spotify_monthly_listeners: a.monthly_listeners ?? 0,
          spotify_followers: a.spotify_followers ?? 0,
          spotify_verified: a.spotify_verified ?? false,
          total_top_track_streams: a.top_track_streams ?? 0,
          track_count: a.track_count ?? 0,
          biography: a.biography ?? null,
          genres: a.genres ?? [],
          image_url: a.image_url ?? null,
          country: a.country ?? null,
          world_rank: a.world_rank ?? 0,
          instagram_handle: a.instagram_handle ?? null,
          social_links: a.social_links ?? {},
          website: a.social_links?.website ?? null,
          wikipedia_url: a.social_links?.wikipedia ?? null,
          source: 'apify_pipeline',
          source_batch: `apify-${today}`,
        }
      })

    if (artistsToInsert.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: artists.length,
        failed: 0,
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('artists')
      .insert(artistsToInsert)
      .select('id')

    if (insertError) throw insertError

    // Apply tags
    if (tagIds?.length > 0 && inserted?.length) {
      const artistTags = inserted.flatMap(artist =>
        tagIds.map((tagId: string) => ({ artist_id: artist.id, tag_id: tagId }))
      )
      await supabase.from('artist_tags').insert(artistTags)
    }

    return NextResponse.json({
      imported: inserted?.length ?? 0,
      skipped: artists.length - artistsToInsert.length,
      failed: 0,
    })
  } catch (error: any) {
    logger.error('[Scraping/Import] Error:', error)
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 })
  }
}
