import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { artistIds } = await request.json()

    if (!artistIds || !Array.isArray(artistIds) || artistIds.length === 0) {
      return NextResponse.json({ error: 'No artist IDs provided' }, { status: 400 })
    }

    // Delete artist_tags first (foreign key constraint)
    const { error: tagsError } = await supabase
      .from('artist_tags')
      .delete()
      .in('artist_id', artistIds)

    if (tagsError) {
      console.error('Error deleting artist tags:', tagsError)
      // Continue anyway, tags might not exist
    }

    // Delete artists
    const { error: deleteError } = await supabase
      .from('artists')
      .delete()
      .in('id', artistIds)

    if (deleteError) throw deleteError

    return NextResponse.json({
      success: true,
      deleted: artistIds.length,
    })
  } catch (error: any) {
    console.error('Error bulk deleting artists:', error)
    return NextResponse.json(
      { error: error.message || 'Bulk delete failed' },
      { status: 500 }
    )
  }
}
