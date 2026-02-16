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

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        artist:artists(*),
        scout:profiles(*),
        conversations(*)
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    // Sort conversations by sent_at
    if (deal.conversations) {
      deal.conversations.sort((a: any, b: any) => 
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      )
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

    const { data: deal, error } = await supabase
      .from('deals')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select(`
        *,
        artist:artists(*),
        scout:profiles(*)
      `)
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
