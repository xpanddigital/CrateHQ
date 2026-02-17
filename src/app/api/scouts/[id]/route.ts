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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch scout profile
    const { data: scout } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!scout) {
      return NextResponse.json({ error: 'Scout not found' }, { status: 404 })
    }

    // Get deal stats
    const { count: totalDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('scout_id', params.id)

    const { count: activeDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('scout_id', params.id)
      .not('stage', 'in', '(closed_won,closed_lost)')

    const { count: wonDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('scout_id', params.id)
      .eq('stage', 'closed_won')

    const { count: lostDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('scout_id', params.id)
      .eq('stage', 'closed_lost')

    // Get pipeline value
    const { data: scoutDeals } = await supabase
      .from('deals')
      .select('estimated_deal_value')
      .eq('scout_id', params.id)
      .not('stage', 'in', '(closed_won,closed_lost)')

    const pipelineValue = scoutDeals?.reduce(
      (sum, deal) => sum + (deal.estimated_deal_value || 0),
      0
    ) || 0

    // Get deals by stage
    const { data: dealsByStage } = await supabase
      .from('deals')
      .select('stage')
      .eq('scout_id', params.id)

    const stageCounts: Record<string, number> = {}
    dealsByStage?.forEach((deal) => {
      stageCounts[deal.stage] = (stageCounts[deal.stage] || 0) + 1
    })

    // Get recent activity
    const { data: recentDeals } = await supabase
      .from('deals')
      .select(`
        id,
        stage,
        created_at,
        artist:artists(id, name)
      `)
      .eq('scout_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      scout: {
        ...scout,
        stats: {
          total_deals: totalDeals || 0,
          active_deals: activeDeals || 0,
          won_deals: wonDeals || 0,
          lost_deals: lostDeals || 0,
          pipeline_value: pipelineValue,
          conversion_rate: totalDeals ? ((wonDeals || 0) / totalDeals * 100).toFixed(1) : '0',
        },
        deals_by_stage: Object.entries(stageCounts).map(([stage, count]) => ({
          stage,
          count,
        })),
        recent_deals: recentDeals || [],
      },
    })
  } catch (error: any) {
    console.error('Error fetching scout details:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scout details' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { full_name, role, is_active } = body

    const updateData: any = {}
    if (full_name !== undefined) updateData.full_name = full_name
    if (role !== undefined) updateData.role = role
    if (is_active !== undefined) updateData.is_active = is_active
    updateData.updated_at = new Date().toISOString()

    const { data: updatedScout, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating scout:', error)
      return NextResponse.json(
        { error: 'Failed to update scout' },
        { status: 500 }
      )
    }

    return NextResponse.json({ scout: updatedScout })
  } catch (error: any) {
    console.error('Error updating scout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update scout' },
      { status: 500 }
    )
  }
}
