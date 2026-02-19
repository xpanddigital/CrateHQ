import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const accountId = request.nextUrl.searchParams.get('account_id')
    if (!accountId) {
      return NextResponse.json({ error: 'Missing account_id' }, { status: 400 })
    }

    const { data: logs, error } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .eq('ig_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Admin/Agents/Logs] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[Admin/Agents/Logs] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
