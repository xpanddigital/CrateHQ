import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch outreach logs with scout profile info
    const { data: logs, error } = await supabase
      .from('outreach_logs')
      .select(`
        *,
        scout:profiles!scout_id(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching outreach logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch outreach history' },
        { status: 500 }
      )
    }

    return NextResponse.json({ logs: logs || [] })
  } catch (error: any) {
    console.error('Error fetching outreach history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch outreach history' },
      { status: 500 }
    )
  }
}
