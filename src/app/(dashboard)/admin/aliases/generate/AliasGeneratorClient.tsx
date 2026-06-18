'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle2, AlertTriangle, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type ScoutRow = {
  id: string
  email: string
  full_name: string | null
  subscription_tier: string
  status: string
  fb_status: 'onboarding' | 'warming' | 'ready' | 'failed' | null
  warming_until: string | null
  fb_persona_json: any
  identity_count: number
}

type GenerateResult = {
  phase: 'a' | 'b'
  persona?: any
  brand?: any
  identity_id?: string
  warming_until?: string
  warming_until_target?: string
  checklist: string[]
  error?: string
}

function StatusBadge({ status }: { status: ScoutRow['fb_status'] }) {
  if (status === 'ready') return <Badge className="bg-green-600">FB Ready</Badge>
  if (status === 'warming') return <Badge className="bg-amber-600">Warming</Badge>
  if (status === 'failed') return <Badge className="bg-red-600">Failed</Badge>
  return <Badge variant="outline">Not started</Badge>
}

function daysFromNow(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function AliasGeneratorClient({ initialScouts }: { initialScouts: ScoutRow[] }) {
  const { toast } = useToast()
  const [scouts, setScouts] = useState(initialScouts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [brief, setBrief] = useState('')
  const [seed, setSeed] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [force, setForce] = useState(false)

  const selected = useMemo(
    () => scouts.find(s => s.id === selectedId) ?? null,
    [scouts, selectedId]
  )

  const phaseRecommended: 'phase_a' | 'phase_b' | null = useMemo(() => {
    if (!selected) return null
    if (selected.fb_status === 'ready') return 'phase_b'
    if (selected.fb_status === null || selected.fb_status === 'onboarding') return 'phase_a'
    return null // warming — neither
  }, [selected])

  async function runPhase(mode: 'phase_a' | 'phase_b') {
    if (!selected) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/aliases/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scout_id: selected.id,
          mode,
          brief: mode === 'phase_b' ? brief : undefined,
          seed: mode === 'phase_a' ? seed : undefined,
          force,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Generation failed', description: data.error ?? 'Unknown error', variant: 'destructive' })
        setResult({ phase: mode === 'phase_a' ? 'a' : 'b', checklist: [], error: data.error })
        return
      }
      setResult(data)
      // Refresh scout list state locally
      if (mode === 'phase_a' && data.warming_until) {
        setScouts(prev =>
          prev.map(s =>
            s.id === selected.id
              ? { ...s, fb_status: 'warming', warming_until: data.warming_until, fb_persona_json: data.persona }
              : s
          )
        )
      }
      if (mode === 'phase_b') {
        setScouts(prev =>
          prev.map(s => (s.id === selected.id ? { ...s, identity_count: s.identity_count + 1 } : s))
        )
      }
      toast({ title: 'Generated', description: mode === 'phase_a' ? 'Phase A persona ready' : 'Phase B brand ready' })
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message ?? String(e), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied' })
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Alias Generator</h1>
        <p className="text-muted-foreground">
          Onboarding accelerator. Phase A creates the scout&apos;s alias Facebook persona
          and starts the 21-day warm-up. Phase B generates each IG alias brand
          identity (name, voice, colors, hashtags) and the operator checklist.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>1. Pick a scout</CardTitle>
          <CardDescription>Only paying scouts are shown (status onboarding or live).</CardDescription>
        </CardHeader>
        <CardContent>
          {scouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paying scouts yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scouts.map(s => {
                const isSelected = s.id === selectedId
                const daysLeft = daysFromNow(s.warming_until)
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedId(s.id)
                      setResult(null)
                    }}
                    className={`text-left rounded-lg border p-4 transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.full_name || s.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      </div>
                      <StatusBadge status={s.fb_status} />
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wider">{s.subscription_tier}</span>
                      <span>·</span>
                      <span>{s.identity_count} alias{s.identity_count === 1 ? '' : 'es'}</span>
                      {s.fb_status === 'warming' && daysLeft != null && (
                        <>
                          <span>·</span>
                          <span>{daysLeft > 0 ? `${daysLeft}d to ready` : 'ready any time'}</span>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>2. Generate</CardTitle>
            <CardDescription>
              Recommended next step:{' '}
              <span className="font-mono">
                {phaseRecommended === 'phase_a'
                  ? 'Phase A (create alias FB persona)'
                  : phaseRecommended === 'phase_b'
                  ? 'Phase B (create an IG alias brand)'
                  : 'Wait for FB warm-up to finish'}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Phase A — Alias Facebook persona</p>
                <Badge variant={phaseRecommended === 'phase_a' ? 'default' : 'outline'}>
                  {selected.fb_status === 'warming' || selected.fb_status === 'ready' ? 'Done' : 'Available'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Generates a fake FB persona (name, age, city, bio, security questions,
                non-face profile photo prompt). Marks scout as warming for 21 days.
              </p>
              <div className="space-y-2">
                <Label htmlFor="seed" className="text-xs">Optional persona seed</Label>
                <Input
                  id="seed"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  placeholder="e.g. 'late 20s, Brooklyn, music-adjacent day job'"
                  disabled={busy}
                />
              </div>
              <Button
                onClick={() => runPhase('phase_a')}
                disabled={busy || (selected.fb_status === 'warming' && !force)}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Run Phase A
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Phase B — IG alias brand identity</p>
                <Badge variant={phaseRecommended === 'phase_b' ? 'default' : 'outline'}>
                  {selected.fb_status === 'ready' ? 'Unlocked' : 'Blocked — FB not ready'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Generates name, tagline, voice, content pillars, colors, hashtags,
                posting schedule for ONE new IG alias. Inserts an
                account_identities row immediately — operator wires the IG account
                ID in afterward.
              </p>
              <div className="space-y-2">
                <Label htmlFor="brief" className="text-xs">Brand brief (required)</Label>
                <Textarea
                  id="brief"
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  placeholder="e.g. 'indie hip-hop, brooklyn vibe, female founder energy, target 50k-500k monthly listener artists'"
                  rows={3}
                  disabled={busy}
                />
              </div>
              <Button
                onClick={() => runPhase('phase_b')}
                disabled={
                  busy ||
                  !brief.trim() ||
                  (selected.fb_status !== 'ready' && !force)
                }
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Run Phase B
              </Button>
            </div>

            <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600/90 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Testing / override</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={e => setForce(e.target.checked)}
                  />
                  Force — skip status gating. Use only for testing. Will overwrite Phase A or run Phase B before FB warm-up.
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Generated — Phase {result.phase.toUpperCase()}
            </CardTitle>
            <CardDescription>
              Operator checklist below. Copy/paste into Notion or your ops Slack.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.persona && (
              <details className="rounded border p-3 text-sm">
                <summary className="cursor-pointer font-medium">FB Persona</summary>
                <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(result.persona, null, 2)}
                </pre>
              </details>
            )}
            {result.brand && (
              <details className="rounded border p-3 text-sm" open>
                <summary className="cursor-pointer font-medium">
                  Brand: {result.brand.display_name}
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    {(['primary','secondary','accent','bg','text'] as const).map(k => (
                      <div key={k} className="flex items-center gap-1">
                        <span
                          className="inline-block h-4 w-4 rounded border"
                          style={{ background: result.brand.colors[k] }}
                        />
                        <span className="font-mono">{result.brand.colors[k]}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm"><span className="font-medium">Tagline:</span> {result.brand.tagline}</p>
                  <p className="text-sm"><span className="font-medium">Bio:</span> {result.brand.persona_bio}</p>
                  <p className="text-sm"><span className="font-medium">Voice:</span> {result.brand.voice_prompt}</p>
                  <p className="text-sm font-mono text-xs">
                    {result.brand.posts_per_day} posts/day on {result.brand.posting_days.join('/')} at{' '}
                    {result.brand.posting_times.join(', ')} · {Math.round(result.brand.carousel_ratio*100)}% carousels
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.brand.hashtag_pool.slice(0, 12).map((h: string) => (
                      <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        #{h}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Operator checklist</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copy(result.checklist.map((c, i) => `${i + 1}. ${c}`).join('\n'))
                  }
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  Copy
                </Button>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-sm">
                {result.checklist.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
