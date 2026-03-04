'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, CalendarRange, Download, RefreshCw, Layers, ImageIcon, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react'

type CalendarPost = {
  id: string
  ig_account_id: string
  identity_id: string | null
  post_type: 'carousel' | 'single'
  status: string
  title: string
  category: string
  caption: string
  nano_prompt: string | null
  slides: any[] | null
  scheduled_date: string
  scheduled_time: string
}

type IdentityMeta = {
  display_name: string
  color_accent: string
  ig_account_id: string
}

type CalendarData = {
  posts: CalendarPost[]
  identities: Record<string, IdentityMeta>
  start: string
  end: string
}

type SafetySummaryStatus = 'ok' | 'warning' | 'critical'

type SafetySummary = {
  status: SafetySummaryStatus
  totalWarnings: number
  totalCritical: number
}

type SafetyResult = {
  summary: SafetySummary
  postingTimeCollisions: { account1: string; account2: string; date: string; time1: string; time2: string }[]
  hashtagOverlap: { account1: string; account2: string; sharedCount: number; sharedTags: string[] }[]
  contentPillarOverlap: { account1: string; account2: string; sharedPillars: string[] }[]
  topicDuplication: { topic: string; accounts: string[] }[]
  themeConflicts: { theme: string; accounts: string[] }[]
}

export default function AdminCalendarPage() {
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [weeks, setWeeks] = useState(2)
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CalendarData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null)
  const [autoScheduling, setAutoScheduling] = useState(false)
  const [safety, setSafety] = useState<SafetyResult | null>(null)
  const [safetyLoading, setSafetyLoading] = useState(false)
  const [safetyError, setSafetyError] = useState<string | null>(null)
  const [showSafetyDetail, setShowSafetyDetail] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set('start', startDate)
      params.set('weeks', String(weeks))
      if (accountFilter !== 'all') params.set('account_id', accountFilter)
      const res = await fetch(`/api/admin/calendar-data?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load calendar')
      }
      setData(json)
    } catch (e: any) {
      console.error('[Calendar] Load error:', e)
      setError(e.message || 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, weeks, accountFilter])

  const loadSafety = async () => {
    try {
      setSafetyLoading(true)
      setSafetyError(null)
      const res = await fetch('/api/admin/safety-check')
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load safety status')
      }
      setSafety(json)
    } catch (e: any) {
      console.error('[Calendar] Safety load error:', e)
      setSafetyError(e.message || 'Failed to load safety status')
    } finally {
      setSafetyLoading(false)
    }
  }

  useEffect(() => {
    loadSafety()
  }, [])

  const days = useMemo(() => {
    if (!data) return []
    const out: { date: string; label: string }[] = []
    const start = new Date(data.start)
    const end = new Date(data.end)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const cur = new Date(start)
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10)
      out.push({
        date: dateStr,
        label: `${dayNames[cur.getDay()]} ${cur.getMonth() + 1}/${cur.getDate()}`,
      })
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }, [data])

  const postsByDate = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {}
    if (!data) return map
    for (const p of data.posts) {
      const d = p.scheduled_date
      if (!map[d]) map[d] = []
      map[d].push(p)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
    }
    return map
  }, [data])

  const handleAutoSchedule = async () => {
    try {
      setAutoScheduling(true)
      setError(null)
      const res = await fetch('/api/admin/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          weeks,
          accountId: accountFilter === 'all' ? 'all' : accountFilter,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Auto-schedule failed')
      }
      await loadData()
    } catch (e: any) {
      console.error('[Calendar] Auto-schedule error:', e)
      setError(e.message || 'Auto-schedule failed')
    } finally {
      setAutoScheduling(false)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    params.set('start', startDate)
    params.set('weeks', String(weeks))
    if (accountFilter !== 'all') params.set('account_id', accountFilter)
    const url = `/api/admin/calendar-export?${params.toString()}`
    window.open(url, '_blank')
  }

  const handleDrop = async (post: CalendarPost, newDate: string) => {
    try {
      const res = await fetch('/api/admin/calendar-schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          scheduled_date: newDate,
          scheduled_time: post.scheduled_time,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to reschedule')
      }
      await loadData()
    } catch (e: any) {
      console.error('[Calendar] Drag-reschedule error:', e)
      setError(e.message || 'Failed to reschedule')
    }
  }

  const gapsSummary = useMemo(() => {
    if (!data) return []
    const summary: { identity_id: string; display_name: string; gaps: number }[] = []
    const daysSet = new Set(days.map((d) => d.date))
    const byIdentity: Record<string, string[]> = {}
    for (const p of data.posts) {
      if (!daysSet.has(p.scheduled_date)) continue
      if (!p.identity_id) continue
      if (!byIdentity[p.identity_id]) byIdentity[p.identity_id] = []
      byIdentity[p.identity_id].push(p.scheduled_date)
    }
    for (const id of Object.keys(data.identities)) {
      const identity = data.identities[id]
      const scheduledDates = new Set(byIdentity[id] || [])
      let gaps = 0
      for (const d of days) {
        if (!scheduledDates.has(d.date)) gaps++
      }
      summary.push({
        identity_id: id,
        display_name: identity.display_name,
        gaps,
      })
    }
    return summary
  }, [data, days])

  const safetyLabel = useMemo(() => {
    if (!safety) return 'Checking safety…'
    if (safety.summary.status === 'ok') {
      return 'All clear — no overlaps detected'
    }
    if (safety.summary.status === 'critical') {
      return `${safety.summary.totalCritical} critical issues`
    }
    return `${safety.summary.totalWarnings} warnings found`
  }, [safety])

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Top controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <label className="text-xs text-muted-foreground">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Weeks</label>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value) || 1)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Account</label>
            <select
              value={accountFilter}
              onChange={(e) =>
                setAccountFilter((e.target.value || 'all') as 'all' | string)
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All Accounts</option>
              {data &&
                Object.values(data.identities).map((id) => (
                  <option key={id.ig_account_id} value={id.ig_account_id}>
                    {id.display_name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {error && (
            <span className="text-xs text-red-400 max-w-xs truncate">{error}</span>
          )}
          {safetyError && (
            <span className="text-xs text-red-400 max-w-xs truncate">{safetyError}</span>
          )}
          <button
            type="button"
            onClick={() => setShowSafetyDetail((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors',
              safety?.summary.status === 'critical' && 'border-red-500/60 text-red-400 bg-red-500/10',
              safety?.summary.status === 'warning' && 'border-yellow-500/60 text-yellow-300 bg-yellow-500/10',
              (!safety || safety.summary.status === 'ok') && 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10'
            )}
          >
            {safetyLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : safety?.summary.status === 'critical' ? (
              <ShieldAlert className="h-3 w-3" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            <span className="truncate max-w-[180px]">{safetyLabel}</span>
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleAutoSchedule}
            disabled={autoScheduling}
          >
            {autoScheduling ? 'Auto-Scheduling…' : 'Auto-Schedule'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open('/api/admin/export-all-content', '_blank')}
          >
            <Download className="h-4 w-4 mr-1" />
            Download all content
          </Button>
        </div>
      </div>

      {/* Safety detail */}
      {showSafetyDetail && safety && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {safety.summary.status === 'critical' ? (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
              )}
              Safety overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {safety.postingTimeCollisions.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold">Posting time collisions (warning)</div>
                {safety.postingTimeCollisions.map((c, idx) => (
                  <div key={idx} className="rounded-md border border-yellow-500/40 bg-yellow-500/5 px-2 py-1.5">
                    <div>
                      {c.account1} and {c.account2} post within 10 minutes on {c.date}{' '}
                      ({c.time1} vs {c.time2})
                    </div>
                    <div className="text-[11px] text-yellow-100/80">
                      Suggested fix: reschedule one account&apos;s post by at least 15 minutes.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {safety.hashtagOverlap.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold">Hashtag overlap (warning)</div>
                {safety.hashtagOverlap.map((h, idx) => (
                  <div key={idx} className="rounded-md border border-yellow-500/40 bg-yellow-500/5 px-2 py-1.5">
                    <div>
                      {h.account1} and {h.account2} share {h.sharedCount} hashtags:{' '}
                      {h.sharedTags.slice(0, 6).join(', ')}
                    </div>
                    <div className="text-[11px] text-yellow-100/80">
                      Suggested fix: adjust one account&apos;s hashtag pool to reduce shared tags.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {safety.contentPillarOverlap.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold">Content pillar overlap (warning)</div>
                {safety.contentPillarOverlap.map((p, idx) => (
                  <div key={idx} className="rounded-md border border-yellow-500/40 bg-yellow-500/5 px-2 py-1.5">
                    <div>
                      {p.account1} and {p.account2} both emphasize:{' '}
                      {p.sharedPillars.join(', ')}
                    </div>
                    <div className="text-[11px] text-yellow-100/80">
                      Suggested fix: diversify pillars so each account owns a distinct mix.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {safety.topicDuplication.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-red-300">Topic duplication (critical)</div>
                {safety.topicDuplication.map((t, idx) => (
                  <div key={idx} className="rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1.5">
                    <div>
                      Topic &quot;{t.topic}&quot; appears for accounts: {t.accounts.join(', ')}
                    </div>
                    <div className="text-[11px] text-red-100/80">
                      Suggested fix: adjust angles or retire duplicate topics for one account.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {safety.themeConflicts.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-red-300">Theme conflicts (critical)</div>
                {safety.themeConflicts.map((t, idx) => (
                  <div key={idx} className="rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1.5">
                    <div>
                      Theme &quot;{t.theme}&quot; is used by: {t.accounts.join(', ')}
                    </div>
                    <div className="text-[11px] text-red-100/80">
                      Suggested fix: assign a distinct visual theme to each account.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {safety.summary.status === 'ok' && (
              <div className="text-emerald-200">
                No safety issues detected across accounts in the current schedule.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gap summary */}
      {gapsSummary.length > 0 && (
        <Card>
          <CardContent className="py-3 flex flex-wrap gap-3 items-center text-xs">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            {gapsSummary.map((g) => (
              <span key={g.identity_id} className="text-muted-foreground">
                {g.display_name} has {g.gaps} gaps in this range
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid" style={{ gridTemplateColumns: `120px repeat(${days.length}, minmax(160px, 1fr))` }}>
            {/* Header row */}
            <div />
            {days.map((d) => (
              <div key={d.date} className="px-2 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
                {d.label}
              </div>
            ))}

            {/* Simple row label for time; we just show posts sorted by time per day */}
            <div className="px-2 py-2 text-[11px] text-muted-foreground border-r border-border">
              Scheduled Posts
            </div>
            {days.map((d) => (
              <div
                key={d.date}
                className="min-h-[120px] border-b border-border px-1 py-1 space-y-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const postId = e.dataTransfer.getData('text/plain')
                  const allPosts = data?.posts || []
                  const post = allPosts.find((p) => p.id === postId)
                  if (post) {
                    handleDrop(post, d.date)
                  }
                }}
              >
                {(postsByDate[d.date] || []).map((p) => {
                  const identity =
                    (p.identity_id && data?.identities[p.identity_id]) || null
                  const accent = identity?.color_accent || '#e8ff47'
                  const time = p.scheduled_time
                    ? p.scheduled_time.slice(0, 5)
                    : ''
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                      onClick={() => setSelectedPost(p)}
                      className="rounded-md border px-2 py-1.5 cursor-move text-[11px] bg-card/70 hover:bg-card transition-colors space-y-0.5"
                      style={{ borderColor: accent }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-semibold truncate"
                          title={identity?.display_name || p.ig_account_id}
                          style={{ color: accent }}
                        >
                          {identity?.display_name || p.ig_account_id}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {time}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {p.post_type === 'carousel' ? (
                          <Layers className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ImageIcon className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="truncate" title={p.title}>
                          {p.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{p.category}</span>
                        <span>{p.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide-over / detail */}
      {selectedPost && (
        <Card className="mt-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {selectedPost.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="text-xs text-muted-foreground">
              {selectedPost.post_type === 'carousel' ? 'Carousel' : 'Single Image'} ·{' '}
              {selectedPost.category}
            </div>
            <div className="text-xs text-muted-foreground">
              Scheduled for {selectedPost.scheduled_date} at{' '}
              {selectedPost.scheduled_time?.slice(0, 5)}
            </div>
            <div className="pt-2">
              <h3 className="text-xs font-semibold mb-1">Caption</h3>
              <p className="text-sm whitespace-pre-wrap break-words">
                {selectedPost.caption}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

