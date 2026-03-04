'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, RefreshCw, Send, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react'

type PublishPost = {
  id: string
  ig_account_id: string
  identity_id: string | null
  post_type: 'carousel' | 'single'
  status: string
  title: string
  category: string
  caption: string
  nano_prompt: string | null
  scheduled_date: string
  scheduled_time: string
  ghl_post_id: string | null
}

type IdentityMeta = {
  display_name: string
  color_accent: string
  ig_account_id: string
}

type CalendarData = {
  posts: PublishPost[]
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
}

export default function AdminPublishPage() {
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all')
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<Record<string, boolean>>({})
  const [publishError, setPublishError] = useState<Record<string, string>>({})
  const [bulkLoading, setBulkLoading] = useState(false)
  const [safety, setSafety] = useState<SafetyResult | null>(null)
  const [safetyLoading, setSafetyLoading] = useState(false)
  const [safetyError, setSafetyError] = useState<string | null>(null)
  const [showSafetyDetail, setShowSafetyDetail] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffDays = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      )
      const weeks = Math.min(4, Math.max(1, Math.ceil((diffDays + 1) / 7)))
      const params = new URLSearchParams()
      params.set('start', startDate)
      params.set('weeks', String(weeks))
      if (accountFilter !== 'all') params.set('account_id', accountFilter)
      const res = await fetch(`/api/admin/calendar-data?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load posts')
      }
      setData(json)
    } catch (e: any) {
      console.error('[Publish] Load error:', e)
      setError(e.message || 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate, accountFilter])

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
      console.error('[Publish] Safety load error:', e)
      setSafetyError(e.message || 'Failed to load safety status')
    } finally {
      setSafetyLoading(false)
    }
  }

  useEffect(() => {
    loadSafety()
  }, [])

  const posts = useMemo(() => {
    if (!data) return []
    return data.posts.filter((p) => {
      const d = p.scheduled_date
      if (startDate && d < startDate) return false
      if (endDate && d > endDate) return false
      return true
    })
  }, [data, startDate, endDate])

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

  const handlePublish = async (postId: string) => {
    setPublishing((prev) => ({ ...prev, [postId]: true }))
    setPublishError((prev) => ({ ...prev, [postId]: '' }))
    try {
      const res = await fetch('/api/admin/publish-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to publish')
      }
      await loadData()
    } catch (e: any) {
      console.error('[Publish] Single publish error:', e)
      setPublishError((prev) => ({
        ...prev,
        [postId]: e.message || 'Failed to publish',
      }))
    } finally {
      setPublishing((prev) => ({ ...prev, [postId]: false }))
    }
  }

  const handleBulkPublish = async () => {
    setBulkLoading(true)
    setError(null)
    try {
      const body: any = {
        dateRange: { start: startDate, end: endDate },
      }
      if (accountFilter !== 'all') {
        body.accountId = accountFilter
      }
      const res = await fetch('/api/admin/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Bulk publish failed')
      }
      if (json.failed && json.errors?.length) {
        setError(
          `Published ${json.published || 0}, failed ${json.failed}: ` +
            json.errors
              .slice(0, 3)
              .map((e: any) => e.error)
              .join('; ')
        )
      }
      await loadData()
    } catch (e: any) {
      console.error('[Publish] Bulk publish error:', e)
      setError(e.message || 'Bulk publish failed')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Account</span>
            <select
              value={accountFilter}
              onChange={(e) =>
                setAccountFilter((e.target.value || 'all') as 'all' | string)
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[160px]"
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
            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors border-border/70"
          >
            {safetyLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : safety?.summary.status === 'critical' ? (
              <ShieldAlert className="h-3 w-3 text-red-400" />
            ) : (
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
            )}
            <span className="truncate max-w-[180px]">{safetyLabel}</span>
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open('/api/admin/export-all-content', '_blank')}
          >
            Download all content
          </Button>
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
            onClick={handleBulkPublish}
            disabled={bulkLoading || !posts.length}
          >
            {bulkLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Publish All Scheduled
              </>
            )}
          </Button>
        </div>
      </div>

      {showSafetyDetail && safety && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {safety.summary.status === 'critical' ? (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
              )}
              Safety status overview
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              This view reflects the latest global safety check across all accounts
              (posting collisions, hashtag overlap, pillars, topics, and themes). For
              full detail, open the safety panel on the Content Calendar.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Scheduled posts ({posts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-3">Account</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">GHL Post</th>
                <th className="py-2 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-1 inline-block animate-spin" />
                    Loading scheduled posts…
                  </td>
                </tr>
              )}
              {!loading && posts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                    No scheduled posts in this range.
                  </td>
                </tr>
              )}
              {!loading &&
                posts.map((p) => {
                  const identity =
                    (p.identity_id && data?.identities[p.identity_id]) || null
                  const statusLabel = p.status || 'scheduled'
                  const isScheduled = statusLabel === 'scheduled'
                  const isFailed = statusLabel === 'failed'
                  const isPublishing = publishing[p.id]
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            border: `1px solid ${
                              identity?.color_accent || 'rgba(255,255,255,0.18)'
                            }`,
                          }}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                identity?.color_accent || 'rgba(255,255,255,0.18)',
                            }}
                          />
                          {identity?.display_name || p.ig_account_id}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {p.scheduled_date}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {p.scheduled_time?.slice(0, 5)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground capitalize">
                        {p.post_type}
                      </td>
                      <td className="py-2 pr-3 max-w-xs truncate">{p.title}</td>
                      <td className="py-2 pr-3 text-xs">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            backgroundColor:
                              statusLabel === 'published'
                                ? 'rgba(74, 222, 128, 0.15)'
                                : statusLabel === 'queued'
                                ? 'rgba(56, 189, 248, 0.15)'
                                : statusLabel === 'failed'
                                ? 'rgba(248, 113, 113, 0.15)'
                                : statusLabel === 'publishing'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'rgba(148, 163, 184, 0.15)',
                            color:
                              statusLabel === 'published'
                                ? '#4ade80'
                                : statusLabel === 'queued'
                                ? '#38bdf8'
                                : statusLabel === 'failed'
                                ? '#f97373'
                                : statusLabel === 'publishing'
                                ? '#eab308'
                                : 'rgba(148, 163, 184, 1)',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {p.ghl_post_id ? (
                          <a
                            href="#"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {p.ghl_post_id}
                          </a>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-0 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {publishError[p.id] && (
                            <span className="flex items-center gap-1 text-[11px] text-red-400 max-w-xs truncate">
                              <AlertTriangle className="h-3 w-3" />
                              {publishError[p.id]}
                            </span>
                          )}
                          <Button
                            size="xs"
                            variant={isFailed ? 'outline' : 'default'}
                            disabled={isPublishing || (!isScheduled && !isFailed)}
                            onClick={() => handlePublish(p.id)}
                          >
                            {isPublishing ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Publishing…
                              </>
                            ) : isFailed ? (
                              'Retry'
                            ) : (
                              'Publish'
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

