import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artistIds, tagIds } = await request.json()

    if (!artistIds || !Array.isArray(artistIds) || artistIds.length === 0) {
      return NextResponse.json({ error: 'Invalid artist IDs' }, { status: 400 })
    }

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json({ error: 'Invalid tag IDs' }, { status: 400 })
    }

    // Create artist_tags entries for each combination
    const artistTags = []
    for (const artistId of artistIds) {
      for (const tagId of tagIds) {
        artistTags.push({
          artist_id: artistId,
          tag_id: tagId,
        })
      }
    }

    // Insert with upsert to avoid duplicates
    const { error } = await supabase
      .from('artist_tags')
      .upsert(artistTags, { onConflict: 'artist_id,tag_id' })

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: artistIds.length,
    })
  } catch (error: any) {
    console.error('Error bulk tagging artists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply tags' },
      { status: 500 }
    )
  }
}
