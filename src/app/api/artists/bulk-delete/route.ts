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

    // Delete related records first to handle foreign key constraints
    // Note: artist_tags has ON DELETE CASCADE, but we'll delete explicitly for clarity
    
    // 1. Delete conversations (references both artist_id and deal_id)
    const { error: conversationsError } = await supabase
      .from('conversations')
      .delete()
      .in('artist_id', artistIds)

    if (conversationsError) {
      console.error('Error deleting conversations:', conversationsError)
    }

    // 2. Delete deals (has conversations that reference it)
    const { error: dealsError } = await supabase
      .from('deals')
      .delete()
      .in('artist_id', artistIds)

    if (dealsError) {
      console.error('Error deleting deals:', dealsError)
    }

    // 3. Delete enrichment jobs
    const { error: enrichmentError } = await supabase
      .from('enrichment_jobs')
      .delete()
      .in('artist_id', artistIds)

    if (enrichmentError) {
      console.error('Error deleting enrichment jobs:', enrichmentError)
    }

    // 4. Delete artist_tags (has ON DELETE CASCADE but delete explicitly)
    const { error: tagsError } = await supabase
      .from('artist_tags')
      .delete()
      .in('artist_id', artistIds)

    if (tagsError) {
      console.error('Error deleting artist tags:', tagsError)
    }

    // 5. Finally, delete artists
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
