'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Coins, Zap, AlertTriangle } from 'lucide-react'

interface UsageResponse {
  window_start: string
  platform: { lifetime_cents: number; month_cents: number; month_calls: number }
  accounts: Array<{
    account_id: string
    account_name: string
    lifetime_cents: number
    month_cents: number
    lifetime_calls: number
    month_calls: number
    kind_breakdown: Record<string, { cents: number; calls: number }>
  }>
  recent: Array<{
    account_name: string
    kind: string
    model: string
    provider: string
    cost_cents: number
    input_tokens: number
    output_tokens: number
    occurred_at: string
  }>
}

function formatCents(c: number): string {
  const dollars = c / 100
  if (dollars >= 100) return `$${dollars.toFixed(0)}`
  if (dollars >= 1) return `$${dollars.toFixed(2)}`
  return `$${dollars.toFixed(3)}`
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AdminTokensPage() {
  const [data, setData] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/usage')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">AI usage</h1>
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error || 'Failed to load usage data'}</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI usage</h1>
        <p className="text-muted-foreground">
          Estimated Anthropic + Gemini spend per account. Costs are server-side estimates based on
          published per-token pricing — the source of truth is each provider&apos;s own invoice.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform — this month</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(data.platform.month_cents)}</div>
            <p className="text-xs text-muted-foreground">
              Since {new Date(data.window_start).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Calls — this month</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.platform.month_calls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform — last 90d</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(data.platform.lifetime_cents)}</div>
            <p className="text-xs text-muted-foreground">Rolling 90-day window</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-account spend (this month)</CardTitle>
          <CardDescription>Sorted by current month spend, highest first</CardDescription>
        </CardHeader>
        <CardContent>
          {data.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {data.accounts.map(acct => {
                const topKinds = Object.entries(acct.kind_breakdown)
                  .sort((a, b) => b[1].cents - a[1].cents)
                  .slice(0, 3)
                return (
                  <div key={acct.account_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{acct.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {acct.month_calls.toLocaleString()} calls this month · {acct.lifetime_calls.toLocaleString()} in 90d
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg">{formatCents(acct.month_cents)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCents(acct.lifetime_cents)} all-time
                        </p>
                      </div>
                    </div>
                    {topKinds.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {topKinds.map(([kind, stats]) => (
                          <span
                            key={kind}
                            className="text-xs bg-muted px-2 py-1 rounded font-mono"
                          >
                            {kind}: {formatCents(stats.cents)} ({stats.calls})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Last 50 AI calls across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="text-xs font-mono space-y-1 max-h-96 overflow-y-auto">
              {data.recent.map((r, i) => (
                <div key={i} className="flex justify-between gap-4 py-1 border-b border-border/50">
                  <span className="text-muted-foreground w-24 shrink-0">{timeAgo(r.occurred_at)}</span>
                  <span className="w-32 shrink-0 truncate">{r.account_name}</span>
                  <span className="w-44 shrink-0 truncate">{r.kind}</span>
                  <span className="w-32 shrink-0 truncate text-muted-foreground">{r.model}</span>
                  <span className="w-24 text-right shrink-0">
                    {r.input_tokens}→{r.output_tokens}
                  </span>
                  <span className="w-20 text-right shrink-0 font-semibold">
                    {formatCents(r.cost_cents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
