import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Fetch enrichment logs
    const query = supabase
      .from('enrichment_logs')
      .select(`
        *,
        scout:profiles!run_by(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

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
