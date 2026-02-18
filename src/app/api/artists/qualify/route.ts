import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { valuateAndQualify } from '@/lib/qualification/qualifier'

/**
 * POST /api/artists/qualify
 * Re-run valuation + qualification on all artists (or a subset).
 *
 * Body: { force?: boolean } — if true, overrides manual overrides too
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const force = body.force === true

    // Fetch all artists with the fields needed for qualification
    const { data: artists, error: fetchError } = await supabase
      .from('artists')
      .select('id, name, estimated_offer, estimated_offer_low, estimated_offer_high, spotify_monthly_listeners, streams_last_month, track_count, qualification_manual_override')
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError
    if (!artists || artists.length === 0) {
      return NextResponse.json({ summary: { qualified: 0, not_qualified: 0, review: 0, total: 0 } })
    }

    let processed = 0
    let skippedManual = 0
    const changes = { qualified: 0, not_qualified: 0, review: 0, pending: 0 }

    // Process in batches of 50 to avoid huge single updates
    const BATCH_SIZE = 50
    for (let i = 0; i < artists.length; i += BATCH_SIZE) {
      const batch = artists.slice(i, i + BATCH_SIZE)
      const updates: Array<{ id: string; [key: string]: any }> = []

      for (const artist of batch) {
        if (artist.qualification_manual_override && !force) {
          skippedManual++
          continue
        }

        const result = valuateAndQualify(artist)
        updates.push({
          id: artist.id,
          ...result,
          qualification_manual_override: false,
        })

        changes[result.qualification_status]++
        processed++
      }

      // Update each artist in the batch
      for (const update of updates) {
        const { id, ...data } = update
        await supabase.from('artists').update(data).eq('id', id)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      skipped_manual: skippedManual,
      summary: {
        qualified: changes.qualified,
        not_qualified: changes.not_qualified,
        review: changes.review,
        total: processed,
      },
    })
  } catch (error: any) {
    console.error('Error running qualification:', error)
    return NextResponse.json(
      { error: error.message || 'Qualification failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/artists/qualify
 * Get qualification stats for all artists.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: artists, error } = await supabase
      .from('artists')
      .select('qualification_status')

    if (error) throw error

    const stats = {
      total: artists?.length || 0,
      qualified: 0,
      not_qualified: 0,
      review: 0,
      pending: 0,
    }

    for (const a of (artists || [])) {
      const status = a.qualification_status || 'pending'
      if (status in stats) {
        stats[status as keyof typeof stats]++
      }
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Error fetching qualification stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
