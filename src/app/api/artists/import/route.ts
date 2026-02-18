import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { valuateAndQualify } from '@/lib/qualification/qualifier'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artists } = await request.json()

    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json({ error: 'No artists provided' }, { status: 400 })
    }

    // Transform and insert artists
    const artistsToInsert = artists.map((artist: any) => {
      // Extract Instagram handle from URL if provided
      let instagram_handle = artist.instagram_handle
      if (artist.instagram_url) {
        const match = artist.instagram_url.match(/instagram\.com\/([^/?]+)/)
        if (match) instagram_handle = match[1]
      }

      // Build social_links object from all available URLs
      const social_links: Record<string, string> = {}
      if (artist.instagram_url) social_links.instagram = artist.instagram_url
      if (artist.facebook_url) social_links.facebook = artist.facebook_url
      if (artist.twitter_url) social_links.twitter = artist.twitter_url
      if (artist.tiktok_url) social_links.tiktok = artist.tiktok_url
      if (artist.youtube_url) social_links.youtube = artist.youtube_url
      if (artist.spotify_url) social_links.spotify = artist.spotify_url
      if (artist.website) social_links.website = artist.website

      return {
        name: artist.name,
        email: artist.email || null,
        instagram_handle: instagram_handle || null,
        instagram_followers: artist.instagram_followers || artist.followers || 0,
        website: artist.website || null,
        spotify_url: artist.spotify_url || null,
        spotify_monthly_listeners: artist.spotify_monthly_listeners || artist.monthly_listeners || 0,
        streams_last_month: artist.streams_last_month || artist.est_streams_month || 0,
        track_count: artist.track_count || (artist.album_count || 0) + (artist.single_count || 0),
        genres: artist.genres || [],
        country: artist.country || null,
        biography: artist.biography || null,
        social_links,
        source: 'csv_import',
        source_batch: new Date().toISOString(),
        is_contactable: !!artist.email,
      }
    })

    const { data, error } = await supabase
      .from('artists')
      .insert(artistsToInsert)
      .select()

    if (error) throw error

    // Run valuation + qualification on all imported artists
    const qualificationSummary = { qualified: 0, not_qualified: 0, review: 0, pending: 0 }

    for (const artist of (data || [])) {
      try {
        const result = valuateAndQualify({
          id: artist.id,
          name: artist.name,
          estimated_offer: artist.estimated_offer,
          estimated_offer_low: artist.estimated_offer_low,
          estimated_offer_high: artist.estimated_offer_high,
          spotify_monthly_listeners: artist.spotify_monthly_listeners || 0,
          streams_last_month: artist.streams_last_month || 0,
          track_count: artist.track_count || 0,
        })

        await supabase.from('artists').update(result).eq('id', artist.id)
        qualificationSummary[result.qualification_status]++
      } catch (err) {
        console.error(`[Import] Qualification failed for ${artist.name}:`, err)
        qualificationSummary.pending++
      }
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      artists: data,
      qualification: qualificationSummary,
    })
  } catch (error: any) {
    console.error('Error importing artists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import artists' },
      { status: 500 }
    )
  }
}
