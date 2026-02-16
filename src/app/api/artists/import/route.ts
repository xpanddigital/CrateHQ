import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const artistsToInsert = artists.map((artist: any) => ({
      name: artist.name,
      email: artist.email || null,
      instagram_handle: artist.instagram_handle || null,
      instagram_followers: artist.instagram_followers || 0,
      website: artist.website || null,
      spotify_monthly_listeners: artist.spotify_monthly_listeners || 0,
      streams_last_month: artist.streams_last_month || 0,
      track_count: artist.track_count || 0,
      genres: artist.genres || [],
      country: artist.country || null,
      source: 'csv_import',
      source_batch: new Date().toISOString(),
      is_contactable: !!artist.email,
    }))

    const { data, error } = await supabase
      .from('artists')
      .insert(artistsToInsert)
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: data.length,
      artists: data,
    })
  } catch (error: any) {
    console.error('Error importing artists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import artists' },
      { status: 500 }
    )
  }
}
