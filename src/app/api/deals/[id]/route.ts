import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/deals/[id] - Get deal with artist data and conversations
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

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        artist:artists(*),
        scout:profiles(id, full_name, avatar_url, email),
        conversations(*)
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({ deal })
  } catch (error: any) {
    console.error('Error fetching deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deal' },
      { status: 500 }
    )
  }
}

// PATCH /api/deals/[id] - Update deal fields
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
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ deal })
  } catch (error: any) {
    console.error('Error updating deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update deal' },
      { status: 500 }
    )
  }
}
