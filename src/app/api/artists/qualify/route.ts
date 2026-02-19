import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { valuateAndQualify } from '@/lib/qualification/qualifier'

const PAGE_SIZE = 500
const PARALLEL_CHUNK = 50

/**
 * POST /api/artists/qualify
 * Re-run valuation + qualification. Supports pagination via offset/limit.
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
    const offset = body.offset ?? 0
    const limit = body.limit ?? PAGE_SIZE

    // Get total count
    const { count: totalCount } = await supabase
      .from('artists')
      .select('id', { count: 'exact', head: true })

    // Fetch one page
    const { data: artists, error: fetchError } = await supabase
      .from('artists')
      .select('id, name, estimated_offer, estimated_offer_low, estimated_offer_high, spotify_monthly_listeners, streams_last_month, track_count, qualification_manual_override')
      .order('id')
      .range(offset, offset + limit - 1)

    if (fetchError) throw fetchError
    if (!artists || artists.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        skipped_manual: 0,
        summary: { qualified: 0, not_qualified: 0, review: 0, total: 0 },
        total: totalCount || 0,
        hasMore: false,
        nextOffset: null,
      })
    }

    let processed = 0
    let skippedManual = 0
    const changes = { qualified: 0, not_qualified: 0, review: 0, pending: 0 }

    const updates: Array<{ id: string; data: Record<string, any> }> = []

    for (const artist of artists) {
      if (artist.qualification_manual_override && !force) {
        skippedManual++
        continue
      }

      const result = valuateAndQualify(artist)
      updates.push({
        id: artist.id,
        data: { ...result, qualification_manual_override: false },
      })

      changes[result.qualification_status]++
      processed++
    }

    // Parallel DB updates in chunks
    for (let i = 0; i < updates.length; i += PARALLEL_CHUNK) {
      const chunk = updates.slice(i, i + PARALLEL_CHUNK)
      await Promise.all(
        chunk.map(({ id, data }) =>
          supabase.from('artists').update(data).eq('id', id)
        )
      )
    }

    const total = totalCount || 0
    const hasMore = (offset + limit) < total

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
      total,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
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
 * Get qualification stats for all artists (paginated count).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use count queries instead of fetching all rows
    const [
      { count: totalCount },
      { count: qualifiedCount },
      { count: notQualifiedCount },
      { count: reviewCount },
    ] = await Promise.all([
      supabase.from('artists').select('id', { count: 'exact', head: true }),
      supabase.from('artists').select('id', { count: 'exact', head: true }).eq('qualification_status', 'qualified'),
      supabase.from('artists').select('id', { count: 'exact', head: true }).eq('qualification_status', 'not_qualified'),
      supabase.from('artists').select('id', { count: 'exact', head: true }).eq('qualification_status', 'review'),
    ])

    const total = totalCount || 0
    const qualified = qualifiedCount || 0
    const not_qualified = notQualifiedCount || 0
    const review = reviewCount || 0
    const pending = total - qualified - not_qualified - review

    return NextResponse.json({
      stats: { total, qualified, not_qualified, review, pending },
    })
  } catch (error: any) {
    console.error('Error fetching qualification stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
