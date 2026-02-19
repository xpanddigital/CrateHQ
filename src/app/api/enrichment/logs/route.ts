import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    if (isAdmin) {
      const { error } = await supabase
        .from('enrichment_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    
      if (error) {
        console.error('Error clearing enrichment logs:', error)
        return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from('enrichment_logs')
        .delete()
        .eq('run_by', user.id)

      if (error) {
        console.error('Error clearing enrichment logs:', error)
        return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing enrichment logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to clear logs' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Fetch enrichment logs with artist data for full export
    // run_by is TEXT (not a FK to profiles), so we don't join profiles here
    const query = supabase
      .from('enrichment_logs')
      .select(`
        *,
        artist:artists!artist_id(
          spotify_url,
          website,
          instagram_handle,
          social_links,
          management_company,
          booking_agency
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10000)

    // Scouts see only their logs, admins see all
    if (!isAdmin) {
      query.eq('run_by', user.id)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching enrichment logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch enrichment logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ logs: logs || [] })
  } catch (error: any) {
    console.error('Error fetching enrichment logs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enrichment logs' },
      { status: 500 }
    )
  }
}
