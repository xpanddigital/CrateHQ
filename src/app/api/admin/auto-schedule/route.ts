import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type IdentityConfig = {
  id: string
  ig_account_id: string
  display_name: string
  posting_times: string[]
  posting_days: string[]
  posts_per_day: number
  carousel_ratio: number
}

type DraftPost = {
  id: string
  ig_account_id: string
  post_type: 'carousel' | 'single'
}

function jitterTime(base: string): string {
  const [h, m] = base.split(':').map((n) => Number(n))
  if (Number.isNaN(h) || Number.isNaN(m)) return base
  const baseMinutes = h * 60 + m
  const offset = Math.floor(Math.random() * 61) - 30 // -30..+30
  let total = baseMinutes + offset
  if (total < 0) total = 0
  if (total > 23 * 60 + 59) total = 23 * 60 + 59
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}:00`
}

function getWeekdayLabel(date: Date): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return labels[date.getDay()]
}

export async function POST(request: NextRequest) {
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { startDate, weeks, accountId } = body || {}

    if (!startDate) {
      return NextResponse.json({ error: 'Missing startDate' }, { status: 400 })
    }

    const weeksNum = Math.max(1, Math.min(4, Number(weeks) || 1))
    const start = new Date(startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + weeksNum * 7 - 1)

    // Identities to schedule
    let idQuery = supabase
      .from('account_identities')
      .select('id, ig_account_id, display_name, posting_times, posting_days, posts_per_day, carousel_ratio')

    if (accountId && accountId !== 'all') {
      idQuery = idQuery.eq('ig_account_id', accountId)
    }

    const { data: identitiesRaw, error: idError } = await idQuery

    if (idError) {
      logger.error('[AutoSchedule] Identities error:', idError)
      return NextResponse.json({ error: 'Failed to load identities' }, { status: 500 })
    }

    const identities: IdentityConfig[] = (identitiesRaw || []).map((row: any) => ({
      id: row.id,
      ig_account_id: row.ig_account_id,
      display_name: row.display_name,
      posting_times: row.posting_times || [],
      posting_days: row.posting_days || [],
      posts_per_day: row.posts_per_day || 2,
      carousel_ratio: typeof row.carousel_ratio === 'number' ? row.carousel_ratio : 0.6,
    }))

    if (!identities.length) {
      return NextResponse.json({ scheduled: [] })
    }

    // Load all drafts for relevant accounts
    const accountIds = Array.from(new Set(identities.map((i) => i.ig_account_id)))
    const { data: drafts, error: draftsError } = await supabase
      .from('content_posts')
      .select('id, ig_account_id, post_type, scheduled_date, status')
      .in('ig_account_id', accountIds)
      .eq('status', 'draft')
      .is('scheduled_date', null)

    if (draftsError) {
      logger.error('[AutoSchedule] Drafts error:', draftsError)
      return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 })
    }

    const draftsByAccount: Record<string, { carousels: DraftPost[]; singles: DraftPost[] }> = {}
    for (const d of drafts || []) {
      const key = d.ig_account_id
      if (!draftsByAccount[key]) {
        draftsByAccount[key] = { carousels: [], singles: [] }
      }
      if (d.post_type === 'carousel') {
        draftsByAccount[key].carousels.push(d as DraftPost)
      } else {
        draftsByAccount[key].singles.push(d as DraftPost)
      }
    }

    type Scheduled = { id: string; ig_account_id: string; scheduled_date: string; scheduled_time: string }
    const scheduled: Scheduled[] = []

    // Used times across all accounts to avoid collisions (within 10 minutes)
    const usedTimes: { date: string; ts: number }[] = []

    for (const identity of identities) {
      const pools = draftsByAccount[identity.ig_account_id] || { carousels: [], singles: [] }
      const { carousels, singles } = pools

      if (!carousels.length && !singles.length) continue

      const current = new Date(start)
      while (current <= end) {
        const dayLabel = getWeekdayLabel(current)
        const isActiveDay = identity.posting_days.includes(dayLabel)
        if (!isActiveDay) {
          current.setDate(current.getDate() + 1)
          continue
        }

        const postsToday = identity.posts_per_day || 2
        if (!identity.posting_times.length) {
          current.setDate(current.getDate() + 1)
          continue
        }

        for (let i = 0; i < postsToday; i++) {
          const wantCarousel = Math.random() < identity.carousel_ratio
          let post: DraftPost | undefined

          if (wantCarousel && carousels.length) {
            post = carousels.shift()
          } else if (!wantCarousel && singles.length) {
            post = singles.shift()
          } else if (carousels.length) {
            post = carousels.shift()
          } else if (singles.length) {
            post = singles.shift()
          }

          if (!post) break

          const timeIndex = i % identity.posting_times.length
          const baseTime = identity.posting_times[timeIndex]
          const dateStr = current.toISOString().slice(0, 10)
          let timeStr = jitterTime(baseTime)

          // Avoid collisions within 10 minutes across accounts when scheduling all
          const candidateTs = new Date(`${dateStr}T${timeStr}`).getTime()
          if (!accountId || accountId === 'all') {
            let adjustedTs = candidateTs
            let attempts = 0
            const tenMin = 10 * 60 * 1000
            while (
              usedTimes.some(
                (t) => t.date === dateStr && Math.abs(t.ts - adjustedTs) < tenMin
              ) &&
              attempts < 5
            ) {
              adjustedTs += tenMin
              attempts++
            }
            const adjustedDate = new Date(adjustedTs)
            timeStr = `${String(adjustedDate.getHours()).padStart(2, '0')}:${String(
              adjustedDate.getMinutes()
            ).padStart(2, '0')}:00`
            usedTimes.push({ date: dateStr, ts: adjustedTs })
          } else {
            usedTimes.push({ date: dateStr, ts: candidateTs })
          }

          scheduled.push({
            id: post.id,
            ig_account_id: identity.ig_account_id,
            scheduled_date: dateStr,
            scheduled_time: timeStr,
          })
        }

        current.setDate(current.getDate() + 1)
      }
    }

    // Persist updates
    for (const s of scheduled) {
      const { error } = await supabase
        .from('content_posts')
        .update({
          scheduled_date: s.scheduled_date,
          scheduled_time: s.scheduled_time,
          status: 'scheduled',
        })
        .eq('id', s.id)

      if (error) {
        logger.error('[AutoSchedule] Update error for', s.id, error)
      }
    }

    return NextResponse.json({ scheduled })
  } catch (e: any) {
    logger.error('[AutoSchedule] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

