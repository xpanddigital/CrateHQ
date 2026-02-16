import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tagIds } = await request.json()

    // Delete existing tags
    await supabase
      .from('artist_tags')
      .delete()
      .eq('artist_id', params.id)

    // Insert new tags
    if (tagIds && tagIds.length > 0) {
      const artistTags = tagIds.map((tagId: string) => ({
        artist_id: params.id,
        tag_id: tagId,
      }))

      const { error: insertError } = await supabase
        .from('artist_tags')
        .insert(artistTags)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating artist tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update tags' },
      { status: 500 }
    )
  }
}
