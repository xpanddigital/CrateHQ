import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSnapshot } from '@/lib/snapshots/create'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: artist, error } = await supabase
      .from('artists')
      .select(`
        *,
        tags:artist_tags(tag:tags(*))
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    // Transform tags structure
    const transformedArtist = {
      ...artist,
      tags: artist.tags?.map((t: any) => t.tag).filter(Boolean) || []
    }

    return NextResponse.json({ artist: transformedArtist })
  } catch (error: any) {
    console.error('Error fetching artist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch artist' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Filter out undefined/null values and fields that shouldn't be updated
    const updateData: any = {}
    const allowedFields = [
      'name', 'country', 'biography', 'genres', 'spotify_url',
      'spotify_monthly_listeners', 'streams_last_month', 'streams_daily',
      'track_count', 'instagram_handle', 'instagram_followers',
      'tiktok_handle', 'twitter_handle', 'website', 'email',
      'email_secondary', 'email_management', 'social_links',
      'image_url', 'growth_mom', 'growth_qoq', 'growth_yoy'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    updateData.updated_at = new Date().toISOString()

    const { data: artist, error } = await supabase
      .from('artists')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase update error:', error)
      throw error
    }

    // Create snapshot if streaming data was updated
    if (updateData.spotify_monthly_listeners || updateData.streams_last_month || 
        updateData.track_count || updateData.instagram_followers) {
      await createSnapshot(params.id, {
        spotify_monthly_listeners: artist.spotify_monthly_listeners,
        streams_last_month: artist.streams_last_month,
        track_count: artist.track_count,
        instagram_followers: artist.instagram_followers,
      })
    }

    return NextResponse.json({ artist })
  } catch (error: any) {
    console.error('Error updating artist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update artist' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('artists')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting artist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete artist' },
      { status: 500 }
    )
  }
}
