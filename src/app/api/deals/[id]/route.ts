import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// GET /api/deals/[id] - Get deal with artist data and conversations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        artist:artists(
          *,
          tags:artist_tags(tag:tags(*))
        ),
        scout:profiles(id, full_name, avatar_url, email),
        conversations(*)
      `)
      .eq('id', id)
      .single()

    // Transform tags structure
    if (deal && deal.artist) {
      deal.artist.tags = deal.artist.tags?.map((t: any) => t.tag) || []
    }

    if (error) throw error

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({ deal })
  } catch (error: any) {
    logger.error('Error fetching deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deal' },
      { status: 500 }
    )
  }
}

// PATCH /api/deals/[id] - Update deal fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.created_at
    delete updates.artist_id
    delete updates.scout_id

    const { data: deal, error } = await supabase
      .from('deals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ deal })
  } catch (error: any) {
    logger.error('Error updating deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update deal' },
      { status: 500 }
    )
  }
}
