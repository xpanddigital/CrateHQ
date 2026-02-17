import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const isAdmin = profile.role === 'admin'

    // Build base queries with role-based filtering
    const dealsQuery = isAdmin
      ? supabase.from('deals').select('*')
      : supabase.from('deals').select('*').eq('scout_id', user.id)

    // 1. Total Artists
    const { count: totalArtists } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })

    // 2. Contactable Artists
    const { count: contactableArtists } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })
      .eq('is_contactable', true)

    // 3. Active Deals (not closed_won or closed_lost)
    const { data: activeDeals, count: activeDealsCount } = await (isAdmin
      ? supabase
          .from('deals')
          .select('estimated_deal_value', { count: 'exact' })
          .not('stage', 'in', '(closed_won,closed_lost)')
      : supabase
          .from('deals')
          .select('estimated_deal_value', { count: 'exact' })
          .eq('scout_id', user.id)
          .not('stage', 'in', '(closed_won,closed_lost)'))

    // 4. Total Pipeline Value
    const totalPipelineValue = activeDeals?.reduce(
      (sum, deal) => sum + (deal.estimated_deal_value || 0),
      0
    ) || 0

    // 5. Unread Inbox Count
    const { count: unreadCount } = await (isAdmin
      ? supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('direction', 'inbound')
      : supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('scout_id', user.id)
          .eq('is_read', false)
          .eq('direction', 'inbound'))

    // 6. Pipeline Funnel (deals by stage)
    const { data: dealsByStage } = await (isAdmin
      ? supabase
          .from('deals')
          .select('stage')
      : supabase
          .from('deals')
          .select('stage')
          .eq('scout_id', user.id))

    const stageCounts: Record<string, number> = {}
    dealsByStage?.forEach((deal) => {
      stageCounts[deal.stage] = (stageCounts[deal.stage] || 0) + 1
    })

    const pipelineFunnel = Object.entries(stageCounts).map(([stage, count]) => ({
      stage,
      count,
    }))

    // 7. Recent Activity (last 20 events)
    // Get recent deals
    const { data: recentDeals } = await (isAdmin
      ? supabase
          .from('deals')
          .select(`
            id,
            stage,
            created_at,
            updated_at,
            stage_changed_at,
            artist:artists!artist_id(id, name),
            scout:profiles!scout_id(full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(10)
      : supabase
          .from('deals')
          .select(`
            id,
            stage,
            created_at,
            updated_at,
            stage_changed_at,
            artist:artists!artist_id(id, name),
            scout:profiles!scout_id(full_name)
          `)
          .eq('scout_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10))

    // Get recent conversations
    const { data: recentConversations } = await (isAdmin
      ? supabase
          .from('conversations')
          .select(`
            id,
            channel,
            direction,
            subject,
            sent_at,
            artist:artists!artist_id(id, name),
            scout:profiles!scout_id(full_name)
          `)
          .order('sent_at', { ascending: false })
          .limit(10)
      : supabase
          .from('conversations')
          .select(`
            id,
            channel,
            direction,
            subject,
            sent_at,
            artist:artists!artist_id(id, name),
            scout:profiles!scout_id(full_name)
          `)
          .eq('scout_id', user.id)
          .order('sent_at', { ascending: false })
          .limit(10))

    // Get recent artists
    const { data: recentArtists } = await supabase
      .from('artists')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    // Combine and sort all activities
    const activities: any[] = []

    recentDeals?.forEach((deal: any) => {
      const artist = Array.isArray(deal.artist) ? deal.artist[0] : deal.artist
      const scout = Array.isArray(deal.scout) ? deal.scout[0] : deal.scout
      activities.push({
        type: 'deal_created',
        timestamp: deal.created_at,
        artist_name: artist?.name || 'Unknown',
        artist_id: artist?.id,
        scout_name: scout?.full_name,
        stage: deal.stage,
        deal_id: deal.id,
      })
    })

    recentConversations?.forEach((conv: any) => {
      const artist = Array.isArray(conv.artist) ? conv.artist[0] : conv.artist
      const scout = Array.isArray(conv.scout) ? conv.scout[0] : conv.scout
      activities.push({
        type: conv.direction === 'inbound' ? 'message_received' : 'message_sent',
        timestamp: conv.sent_at,
        artist_name: artist?.name || 'Unknown',
        artist_id: artist?.id,
        scout_name: scout?.full_name,
        channel: conv.channel,
        subject: conv.subject,
      })
    })

    recentArtists?.forEach((artist) => {
      activities.push({
        type: 'artist_added',
        timestamp: artist.created_at,
        artist_name: artist.name,
        artist_id: artist.id,
      })
    })

    // Sort by timestamp and take top 20
    const recentActivity = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)

    // 8. Scout Leaderboard (admin only)
    let scoutLeaderboard = null
    if (isAdmin) {
      const { data: scouts } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'scout')

      if (scouts) {
        const leaderboard = await Promise.all(
          scouts.map(async (scout) => {
            const { count: dealsCreated } = await supabase
              .from('deals')
              .select('*', { count: 'exact', head: true })
              .eq('scout_id', scout.id)

            const { count: dealsWon } = await supabase
              .from('deals')
              .select('*', { count: 'exact', head: true })
              .eq('scout_id', scout.id)
              .eq('stage', 'closed_won')

            const { data: scoutDeals } = await supabase
              .from('deals')
              .select('estimated_deal_value')
              .eq('scout_id', scout.id)
              .not('stage', 'in', '(closed_won,closed_lost)')

            const pipelineValue = scoutDeals?.reduce(
              (sum, deal) => sum + (deal.estimated_deal_value || 0),
              0
            ) || 0

            return {
              scout_id: scout.id,
              scout_name: scout.full_name,
              deals_created: dealsCreated || 0,
              deals_won: dealsWon || 0,
              pipeline_value: pipelineValue,
            }
          })
        )

        scoutLeaderboard = leaderboard.sort((a, b) => b.pipeline_value - a.pipeline_value)
      }
    }

    return NextResponse.json({
      stats: {
        total_artists: totalArtists || 0,
        contactable_artists: contactableArtists || 0,
        active_deals: activeDealsCount || 0,
        total_pipeline_value: totalPipelineValue,
        unread_inbox: unreadCount || 0,
      },
      pipeline_funnel: pipelineFunnel,
      recent_activity: recentActivity,
      scout_leaderboard: scoutLeaderboard,
      profile: {
        role: profile.role,
        full_name: profile.full_name,
      },
    })
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
