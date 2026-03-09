import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { accountId, dateRange } = body || {}

    let query = supabase
      .from('content_posts')
      .select('id, ig_account_id, scheduled_date, scheduled_time, status')
      .eq('status', 'scheduled')
      .not('scheduled_date', 'is', null)

    if (accountId) {
      query = query.eq('ig_account_id', accountId)
    }

    if (dateRange?.start) {
      query = query.gte('scheduled_date', dateRange.start)
    }
    if (dateRange?.end) {
      query = query.lte('scheduled_date', dateRange.end)
    }

    const { data: posts, error: postsError } = await query

    if (postsError) {
      console.error('[BulkPublish] Query error:', postsError)
      return NextResponse.json({ error: 'Failed to load scheduled posts' }, { status: 500 })
    }

    let published = 0
    let failed = 0
    const errors: { postId: string; error: string }[] = []

    for (const p of posts || []) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/publish-to-ghl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: p.id }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          failed++
          errors.push({
            postId: p.id,
            error: json.error || 'Failed to publish',
          })
        } else {
          published++
        }
      } catch (e: any) {
        failed++
        errors.push({
          postId: p.id,
          error: e.message || 'Failed to publish',
        })
      }

      // 3-second delay between publishes
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    return NextResponse.json({ published, failed, errors })
  } catch (e: any) {
    console.error('[BulkPublish] Unhandled error:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

