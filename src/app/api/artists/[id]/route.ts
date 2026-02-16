import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { data: artist, error } = await supabase
      .from('artists')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

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
