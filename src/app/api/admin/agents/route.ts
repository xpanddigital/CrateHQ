import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

    // Fetch all IG accounts
    const { data: accounts, error: accError } = await supabase
      .from('ig_accounts')
      .select('*')
      .order('created_at', { ascending: true })

    if (accError) {
      console.error('[Admin/Agents] Accounts fetch error:', accError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    // Fetch today's heartbeat stats per account
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayHeartbeats } = await supabase
      .from('agent_heartbeats')
      .select('ig_account_id, messages_found, messages_sent')
      .gte('created_at', todayStart.toISOString())

    // Aggregate today's stats by account
    const statsMap: Record<string, { found: number; sent: number }> = {}
    for (const hb of todayHeartbeats || []) {
      if (!statsMap[hb.ig_account_id]) {
        statsMap[hb.ig_account_id] = { found: 0, sent: 0 }
      }
      statsMap[hb.ig_account_id].found += hb.messages_found || 0
      statsMap[hb.ig_account_id].sent += hb.messages_sent || 0
    }

    const agents = (accounts || []).map(acct => ({
      ...acct,
      messages_today: statsMap[acct.id] || { found: 0, sent: 0 },
    }))

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('[Admin/Agents] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH — toggle is_active for an account
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { account_id, is_active } = body

    if (!account_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Missing account_id or is_active' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ig_accounts')
      .update({ is_active })
      .eq('id', account_id)

    if (error) {
      console.error('[Admin/Agents] Toggle error:', error)
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin/Agents] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
