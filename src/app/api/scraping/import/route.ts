import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { artists, tagIds } = await request.json()

    if (!artists || !Array.isArray(artists)) {
      return NextResponse.json({ error: 'Invalid artists data' }, { status: 400 })
    }

    // Get existing artists to check for duplicates
    const spotifyUrls = artists.map((a: any) => a._url).filter(Boolean)
    const { data: existing } = await supabase
      .from('artists')
      .select('spotify_url')
      .in('spotify_url', spotifyUrls)

    const existingUrls = new Set(existing?.map(a => a.spotify_url) || [])

    // Transform artists
    const artistsToInsert = artists
      .filter((a: any) => !existingUrls.has(a._url))
      .map((artist: any) => {
        // Build social links with verified and rank
        const socialLinks = artist.social_links || {}
        if (artist.verified !== undefined) socialLinks.verified = artist.verified
        if (artist.worldRank) socialLinks.world_rank = artist.worldRank

        // Note: streams_last_month should come from actual monthly stream data
        // topTrackStreams is the sum of total streams for top 10 tracks (not monthly)
        // If streams_last_month is not provided, the valuation function will derive it
        // from spotify_monthly_listeners × 2.5 as a proxy
        return {
          name: artist.name,
          spotify_url: artist._url,
          spotify_monthly_listeners: artist.monthlyListeners || 0,
          streams_last_month: artist.streams_last_month || 0,
          track_count: artist.trackCount || 0,
          biography: artist.biography,
          genres: artist.genres || [],
          image_url: artist.image_url,
          country: artist.country,
          instagram_handle: artist.instagram_handle,
          social_links: socialLinks,
          source: 'apify_pipeline',
          source_batch: `apify-${new Date().toISOString().split('T')[0]}`,
        }
      })

    if (artistsToInsert.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: artists.length,
        failed: 0,
      })
    }

    // Insert artists
    const { data: inserted, error: insertError } = await supabase
      .from('artists')
      .insert(artistsToInsert)
      .select()

    if (insertError) throw insertError

    // Apply tags if provided
    if (tagIds && tagIds.length > 0 && inserted) {
      const artistTags = []
      for (const artist of inserted) {
        for (const tagId of tagIds) {
          artistTags.push({
            artist_id: artist.id,
            tag_id: tagId,
          })
        }
      }
      
      await supabase.from('artist_tags').insert(artistTags)
    }

    return NextResponse.json({
      imported: inserted?.length || 0,
      skipped: artists.length - artistsToInsert.length,
      failed: 0,
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}
