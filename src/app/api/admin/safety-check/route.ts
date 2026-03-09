import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, error: null }
}

function toMinutes(date: string, time: string | null): number {
  const base = new Date(`${date}T${time || '00:00:00'}Z`)
  return Math.floor(base.getTime() / 60000)
}

type SafetySummaryStatus = 'ok' | 'warning' | 'critical'

export async function GET(_request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const today = new Date()
    const startDate = today.toISOString().slice(0, 10)
    const end = new Date(today)
    end.setDate(end.getDate() + 6)
    const endDate = end.toISOString().slice(0, 10)

    // CHECK 1 — POSTING TIME COLLISIONS
    const { data: posts, error: postsError } = await supabase
      .from('content_posts')
      .select(
        'id, ig_account_id, identity_id, status, scheduled_date, scheduled_time'
      )
      .in('status', ['scheduled', 'published'])
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)

    if (postsError) {
      logger.error('[SafetyCheck] Posts error:', postsError)
    }

    let accountNames: Record<string, string> = {}
    if (posts && posts.length > 0) {
      const accountIds = Array.from(
        new Set(posts.map((p: any) => p.ig_account_id).filter(Boolean))
      )
      if (accountIds.length) {
        const { data: accounts } = await supabase
          .from('ig_accounts')
          .select('id, ig_username')
          .in('id', accountIds)
        for (const acc of accounts || []) {
          accountNames[acc.id] = acc.ig_username || acc.id
        }
      }
    }

    const postingTimeCollisions: {
      account1: string
      account2: string
      date: string
      time1: string
      time2: string
    }[] = []

    if (posts && posts.length > 0) {
      const byDate: Record<string, any[]> = {}
      for (const p of posts) {
        if (!p.scheduled_date || !p.scheduled_time) continue
        if (!p.ig_account_id) continue
        const d = p.scheduled_date
        if (!byDate[d]) byDate[d] = []
        byDate[d].push(p)
      }

      const TEN_MIN = 10
      for (const [date, dayPosts] of Object.entries(byDate)) {
        for (let i = 0; i < dayPosts.length; i++) {
          for (let j = i + 1; j < dayPosts.length; j++) {
            const a = dayPosts[i]
            const b = dayPosts[j]
            if (!a.ig_account_id || !b.ig_account_id) continue
            if (a.ig_account_id === b.ig_account_id) continue
            const m1 = toMinutes(date, a.scheduled_time)
            const m2 = toMinutes(date, b.scheduled_time)
            if (Math.abs(m1 - m2) <= TEN_MIN) {
              const key = [
                a.ig_account_id,
                b.ig_account_id,
                date,
                a.scheduled_time,
                b.scheduled_time,
              ].join('|')
              if (!postingTimeCollisions.some((c) => (
                c.account1 === accountNames[a.ig_account_id] &&
                c.account2 === accountNames[b.ig_account_id] &&
                c.date === date &&
                c.time1 === a.scheduled_time &&
                c.time2 === b.scheduled_time
              ))) {
                postingTimeCollisions.push({
                  account1: accountNames[a.ig_account_id] || a.ig_account_id,
                  account2: accountNames[b.ig_account_id] || b.ig_account_id,
                  date,
                  time1: a.scheduled_time.slice(0, 5),
                  time2: b.scheduled_time.slice(0, 5),
                })
              }
            }
          }
        }
      }
    }

    // Load identities for the remaining checks
    const { data: identities, error: idError } = await supabase
      .from('account_identities')
      .select(
        'id, ig_account_id, display_name, theme_id, hashtag_pool, content_pillars'
      )

    if (idError) {
      logger.error('[SafetyCheck] Identities error:', idError)
    }

    const hashtagOverlap: {
      account1: string
      account2: string
      sharedCount: number
      sharedTags: string[]
    }[] = []

    const contentPillarOverlap: {
      account1: string
      account2: string
      sharedPillars: string[]
    }[] = []

    const themeConflicts: {
      theme: string
      accounts: string[]
    }[] = []

    if (identities && identities.length > 0) {
      const normHashtags = identities.map((id) => ({
        name: id.display_name || id.ig_account_id || 'Unknown',
        tags: Array.from(
          new Set(
            (id.hashtag_pool || []).map((h: string) =>
              (h || '').toLowerCase().replace(/^#/, '')
            ).filter(Boolean)
          )
        ),
      }))

      // CHECK 2 — HASHTAG OVERLAP
      for (let i = 0; i < normHashtags.length; i++) {
        for (let j = i + 1; j < normHashtags.length; j++) {
          const a = normHashtags[i]
          const b = normHashtags[j]
          const setB = new Set(b.tags)
          const shared = a.tags.filter((t) => setB.has(t))
          if (shared.length > 3) {
            hashtagOverlap.push({
              account1: a.name,
              account2: b.name,
              sharedCount: shared.length,
              sharedTags: shared.slice(0, 20) as string[],
            })
          }
        }
      }

      // CHECK 3 — CONTENT PILLAR OVERLAP
      const normPillars = identities.map((id) => ({
        name: id.display_name || id.ig_account_id || 'Unknown',
        pillars: Array.from(new Set((id.content_pillars || []).filter(Boolean))),
      }))

      for (let i = 0; i < normPillars.length; i++) {
        for (let j = i + 1; j < normPillars.length; j++) {
          const a = normPillars[i]
          const b = normPillars[j]
          const setB = new Set(b.pillars)
          const shared = a.pillars.filter((p) => setB.has(p))
          if (shared.length > 1) {
            contentPillarOverlap.push({
              account1: a.name,
              account2: b.name,
              sharedPillars: shared as string[],
            })
          }
        }
      }

      // CHECK 5 — THEME CONFLICTS
      const themeMap: Record<string, string[]> = {}
      identities.forEach((id) => {
        if (!id.theme_id) return
        if (!themeMap[id.theme_id]) themeMap[id.theme_id] = []
        themeMap[id.theme_id].push(id.display_name || id.ig_account_id || 'Unknown')
      })
      for (const [theme, accounts] of Object.entries(themeMap)) {
        if (accounts.length > 1) {
          themeConflicts.push({ theme, accounts })
        }
      }
    }

    // CHECK 4 — TOPIC DUPLICATION
    const { data: topics, error: topicsError } = await supabase
      .from('content_topics')
      .select('topic_hash, title, ig_account_id')

    if (topicsError) {
      logger.error('[SafetyCheck] Topics error:', topicsError)
    }

    const topicDuplication: {
      topic: string
      accounts: string[]
    }[] = []

    if (topics && topics.length > 0) {
      const topicMap: Record<string, { title: string; accounts: Set<string> }> = {}
      for (const t of topics) {
        if (!t.topic_hash) continue
        if (!topicMap[t.topic_hash]) {
          topicMap[t.topic_hash] = {
            title: t.title || t.topic_hash,
            accounts: new Set(),
          }
        }
        if (t.ig_account_id) {
          topicMap[t.topic_hash].accounts.add(t.ig_account_id)
        }
      }
      for (const { title, accounts } of Object.values(topicMap)) {
        const arr = Array.from(accounts)
        if (arr.length > 1) {
          topicDuplication.push({
            topic: title,
            accounts: arr,
          })
        }
      }
    }

    // Summary
    const warningCount =
      postingTimeCollisions.length +
      hashtagOverlap.length +
      contentPillarOverlap.length

    const criticalCount = topicDuplication.length + themeConflicts.length

    let status: SafetySummaryStatus = 'ok'
    if (criticalCount > 0) {
      status = 'critical'
    } else if (warningCount > 0) {
      status = 'warning'
    }

    return NextResponse.json({
      summary: {
        status,
        totalWarnings: warningCount,
        totalCritical: criticalCount,
      },
      postingTimeCollisions,
      hashtagOverlap,
      contentPillarOverlap,
      topicDuplication,
      themeConflicts,
    })
  } catch (e: any) {
    logger.error('[SafetyCheck] Unhandled error:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

