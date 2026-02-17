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

    // Get current artist data
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', params.id)
      .single()

    if (artistError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    // Get snapshots for growth calculation
    // Note: artist_snapshots table may not exist yet — handle gracefully
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('artist_snapshots')
      .select('*')
      .eq('artist_id', params.id)
      .order('snapshot_date', { ascending: false })
      .limit(365)

    // If table doesn't exist, return zeroed growth data instead of crashing
    if (snapshotsError) {
      console.warn('Growth calculation skipped:', snapshotsError.message)
      return NextResponse.json({
        growth_mom: artist.growth_mom || 0,
        growth_qoq: artist.growth_qoq || 0,
        growth_yoy: artist.growth_yoy || 0,
        trend_direction: artist.growth_status || 'stable',
        sparkline: [],
      })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    // Find closest snapshots to target dates
    const snapshot30 = snapshots?.find(s => new Date(s.snapshot_date) <= thirtyDaysAgo)
    const snapshot90 = snapshots?.find(s => new Date(s.snapshot_date) <= ninetyDaysAgo)
    const snapshot365 = snapshots?.find(s => new Date(s.snapshot_date) <= oneYearAgo)

    const current = artist.spotify_monthly_listeners

    // Calculate growth percentages
    const growth_mom = snapshot30?.spotify_monthly_listeners
      ? ((current - snapshot30.spotify_monthly_listeners) / snapshot30.spotify_monthly_listeners)
      : 0

    const growth_qoq = snapshot90?.spotify_monthly_listeners
      ? ((current - snapshot90.spotify_monthly_listeners) / snapshot90.spotify_monthly_listeners)
      : 0

    const growth_yoy = snapshot365?.spotify_monthly_listeners
      ? ((current - snapshot365.spotify_monthly_listeners) / snapshot365.spotify_monthly_listeners)
      : 0

    // Determine trend direction
    let trend_direction: 'growing' | 'stable' | 'declining'
    if (growth_mom > 0.05) {
      trend_direction = 'growing'
    } else if (growth_mom < -0.05) {
      trend_direction = 'declining'
    } else {
      trend_direction = 'stable'
    }

    // Build sparkline data (last 12 months)
    const sparklineData = []
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000)
      const snapshot = snapshots?.find(s => {
        const snapDate = new Date(s.snapshot_date)
        return Math.abs(snapDate.getTime() - targetDate.getTime()) < 15 * 24 * 60 * 60 * 1000
      })
      sparklineData.push({
        month: targetDate.toISOString().slice(0, 7),
        listeners: snapshot?.spotify_monthly_listeners || null,
      })
    }

    // Update artist record with growth metrics
    await supabase
      .from('artists')
      .update({
        growth_mom,
        growth_qoq,
        growth_yoy,
        growth_status: trend_direction,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    return NextResponse.json({
      growth_mom,
      growth_qoq,
      growth_yoy,
      trend_direction,
      sparkline: sparklineData,
    })
  } catch (error: any) {
    console.error('Error calculating growth:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate growth' },
      { status: 500 }
    )
  }
}
