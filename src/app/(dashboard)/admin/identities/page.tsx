'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Palette, Sparkles, Hash, Clock, ShieldCheck, ShieldAlert } from 'lucide-react'

type AccountIdentity = {
  id: string
  ig_account_id: string | null
  display_name: string
  theme_id: string
  color_primary: string
  color_secondary: string
  color_bg: string
  color_text: string
  color_accent: string
  font_heading: string
  font_body: string
  carousel_style: any
  voice_prompt: string
  caption_style: string
  content_pillars: string[]
  image_styles: string[]
  image_subjects: string[]
  posting_times: string[]
  posting_days: string[]
  posts_per_day: number
  carousel_ratio: number
  hashtag_pool: string[]
  ig_username?: string | null
  ghl_location_id?: string | null
  ghl_social_account_id?: string | null
  ghl_api_key?: string | null
}

type IgAccount = {
  id: string
  ig_username: string
  ghl_location_id?: string | null
  ghl_social_account_id?: string | null
  ghl_api_key?: string | null
}

type IdentitiesResponse = {
  identities: AccountIdentity[]
  available_accounts: IgAccount[]
}

type SafetySummaryStatus = 'ok' | 'warning' | 'critical'

type SafetySummary = {
  status: SafetySummaryStatus
  totalWarnings: number
  totalCritical: number
}

type SafetyResult = {
  summary: SafetySummary
  hashtagOverlap: { account1: string; account2: string; sharedCount: number; sharedTags: string[] }[]
  contentPillarOverlap: { account1: string; account2: string; sharedPillars: string[] }[]
  themeConflicts: { theme: string; accounts: string[] }[]
}

const THEME_PRESETS: Record<
  string,
  {
    bg: string
    accent: string
    accent2: string
    text: string
    surface: string
    fontHeading: string
    fontBody: string
  }
> = {
  midnight_neon: { bg: '#08080e', accent: '#8b5cf6', accent2: '#c084fc', text: '#e8e6f0', surface: '#0e0d18', fontHeading: 'Instrument Sans', fontBody: 'DM Sans' },
  studio_warmth: { bg: '#141110', accent: '#d4915c', accent2: '#e8b080', text: '#f0e6d6', surface: '#1a1610', fontHeading: 'Playfair Display', fontBody: 'DM Sans' },
  signal_white: { bg: '#f2f0ec', accent: '#2563eb', accent2: '#1a1a1a', text: '#1a1a1a', surface: '#e8e5e0', fontHeading: 'DM Sans', fontBody: 'DM Sans' },
  concrete: { bg: '#1a1a1a', accent: '#ef4444', accent2: '#fca5a5', text: '#e5e5e5', surface: '#262626', fontHeading: 'Space Mono', fontBody: 'Work Sans' },
  ocean_depth: { bg: '#0a1628', accent: '#14b8a6', accent2: '#5eead4', text: '#e0f2fe', surface: '#0f2035', fontHeading: 'Outfit', fontBody: 'Source Sans 3' },
  desert_gold: { bg: '#1e1a14', accent: '#eab308', accent2: '#fde047', text: '#fef3c7', surface: '#2a2418', fontHeading: 'Crimson Pro', fontBody: 'Karla' },
  neon_mint: { bg: '#0a120e', accent: '#34d399', accent2: '#6ee7b7', text: '#d1fae5', surface: '#0f1a14', fontHeading: 'Rajdhani', fontBody: 'Nunito' },
  vintage_film: { bg: '#181410', accent: '#c2410c', accent2: '#fb923c', text: '#fed7aa', surface: '#221c14', fontHeading: 'Lora', fontBody: 'Fira Sans' },
  arctic: { bg: '#f0f4f8', accent: '#3b82f6', accent2: '#1e40af', text: '#1e293b', surface: '#e2e8f0', fontHeading: 'Poppins', fontBody: 'Poppins' },
  noir: { bg: '#000000', accent: '#ffffff', accent2: '#a3a3a3', text: '#f5f5f5', surface: '#171717', fontHeading: 'Cormorant Garamond', fontBody: 'Inter' },
}

const CONTENT_PILLARS = [
  'INDUSTRY DECODED',
  'A&R INSIDER',
  'ARTIST PLAYBOOK',
  'MONEY TALK',
  'MYTH BUSTER',
  'RELEASE STRATEGY',
  'THE SIGNAL',
  'REAL TALK',
] as const

const IMAGE_STYLES = ['cinematic', 'analog', 'minimal', 'neon', 'texture', 'aerial', 'motion', 'bw'] as const

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type CaptionStyle = 'punchy-short' | 'editorial-long' | 'data-driven'

type FormState = {
  id?: string
  ig_account_id: string
  display_name: string
  theme_id: string
  color_primary: string
  color_secondary: string
  color_bg: string
  color_text: string
  color_accent: string
  font_heading: string
  font_body: string
  voice_prompt: string
  caption_style: CaptionStyle
  content_pillars: string[]
  image_styles: string[]
  image_subjects_raw: string
  posting_times: string[]
  new_posting_time: string
  posting_days: string[]
  posts_per_day: number
  carousel_ratio_percent: number
  hashtag_text: string
  ghl_location_id: string
  ghl_social_account_id: string
  ghl_api_key: string
}

const emptyFormState: FormState = {
  ig_account_id: '',
  display_name: '',
  theme_id: '',
  color_primary: '',
  color_secondary: '',
  color_bg: '',
  color_text: '',
  color_accent: '',
  font_heading: '',
  font_body: '',
  voice_prompt: '',
  caption_style: 'punchy-short',
  content_pillars: [],
  image_styles: [],
  image_subjects_raw: '',
  posting_times: [],
  new_posting_time: '',
  posting_days: [],
  posts_per_day: 2,
  carousel_ratio_percent: 60,
  hashtag_text: '',
  ghl_location_id: '',
  ghl_social_account_id: '',
  ghl_api_key: '',
}

export default function AdminIdentitiesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggestingVoice, setSuggestingVoice] = useState(false)
  const [generatingHashtags, setGeneratingHashtags] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identities, setIdentities] = useState<AccountIdentity[]>([])
  const [availableAccounts, setAvailableAccounts] = useState<IgAccount[]>([])
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyFormState)
  const [safety, setSafety] = useState<SafetyResult | null>(null)
  const [safetyLoading, setSafetyLoading] = useState(false)
  const [safetyError, setSafetyError] = useState<string | null>(null)

  const themeUsage = useMemo(() => {
    const map: Record<string, string> = {}
    identities.forEach((id) => {
      if (id.theme_id) {
        map[id.theme_id] = id.display_name || id.ig_username || id.ig_account_id || 'Unknown'
      }
    })
    return map
  }, [identities])

  const isEditing = selectedId && selectedId !== 'new'

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/identities')
      const data: IdentitiesResponse = await res.json()
      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to load identities')
      }
      setIdentities(data.identities || [])
      setAvailableAccounts(data.available_accounts || [])
      setError(null)
    } catch (e: any) {
      console.error('Load identities error:', e)
      setError(e.message || 'Failed to load identities')
    } finally {
      setLoading(false)
    }
  }

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
      console.error('Load safety error:', e)
      setSafetyError(e.message || 'Failed to load safety status')
    } finally {
      setSafetyLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadSafety()
  }, [])

  const currentHashtagOverlap = useMemo(() => {
    if (!safety) return null
    if (!form.display_name) return null
    const name = form.display_name
    const matches = safety.hashtagOverlap.filter(
      (h) => h.account1 === name || h.account2 === name
    )
    if (!matches.length) return null
    const totalShared = matches.reduce((sum, m) => sum + m.sharedCount, 0)
    return { count: totalShared, pairs: matches }
  }, [safety, form.display_name])

  const currentPillarOverlap = useMemo(() => {
    if (!safety) return null
    if (!form.display_name) return null
    const name = form.display_name
    const matches = safety.contentPillarOverlap.filter(
      (p) => p.account1 === name || p.account2 === name
    )
    if (!matches.length) return null
    return matches
  }, [safety, form.display_name])

  const safetyLabel = useMemo(() => {
    if (!safety) return 'Checking safety…'
    if (safety.summary.status === 'ok') return 'All clear — no overlaps detected'
    if (safety.summary.status === 'critical') {
      return `${safety.summary.totalCritical} critical issues`
    }
    return `${safety.summary.totalWarnings} warnings found`
  }, [safety])

  const startNew = () => {
    setSelectedId('new')
    const first = availableAccounts[0]
    setForm({
      ...emptyFormState,
      ig_account_id: first?.id || '',
      display_name: first?.ig_username || '',
      ghl_location_id: first?.ghl_location_id ?? '',
      ghl_social_account_id: first?.ghl_social_account_id ?? '',
      ghl_api_key: first?.ghl_api_key ?? '',
    })
  }

  const startEdit = (identity: AccountIdentity) => {
    setSelectedId(identity.id)
    setForm({
      id: identity.id,
      ig_account_id: identity.ig_account_id || '',
      display_name: identity.display_name || identity.ig_username || '',
      theme_id: identity.theme_id || '',
      color_primary: identity.color_primary,
      color_secondary: identity.color_secondary,
      color_bg: identity.color_bg,
      color_text: identity.color_text,
      color_accent: identity.color_accent,
      font_heading: identity.font_heading,
      font_body: identity.font_body,
      voice_prompt: identity.voice_prompt,
      caption_style: (identity.caption_style as CaptionStyle) || 'punchy-short',
      content_pillars: identity.content_pillars || [],
      image_styles: identity.image_styles || [],
      image_subjects_raw: (identity.image_subjects || []).join(', '),
      posting_times: identity.posting_times || [],
      new_posting_time: '',
      posting_days: identity.posting_days || [],
      posts_per_day: identity.posts_per_day || 2,
      carousel_ratio_percent: typeof identity.carousel_ratio === 'number' ? Math.round(identity.carousel_ratio * 100) : 60,
      hashtag_text: (identity.hashtag_pool || []).join('\n'),
      ghl_location_id: identity.ghl_location_id ?? '',
      ghl_social_account_id: identity.ghl_social_account_id ?? '',
      ghl_api_key: identity.ghl_api_key ?? '',
    })
  }

  const handleThemeSelect = (themeId: string) => {
    const preset = THEME_PRESETS[themeId]
    if (!preset) return
    setForm((prev) => ({
      ...prev,
      theme_id: themeId,
      color_bg: preset.bg,
      color_primary: preset.accent,
      color_secondary: preset.accent2,
      color_text: preset.text,
      color_accent: preset.accent,
      font_heading: preset.fontHeading,
      font_body: preset.fontBody,
    }))
  }

  const togglePillar = (pillar: string) => {
    setForm((prev) => {
      const has = prev.content_pillars.includes(pillar)
      if (has) {
        return { ...prev, content_pillars: prev.content_pillars.filter((p) => p !== pillar) }
      }
      if (prev.content_pillars.length >= 3) return prev
      return { ...prev, content_pillars: [...prev.content_pillars, pillar] }
    })
  }

  const toggleImageStyle = (style: string) => {
    setForm((prev) => {
      const has = prev.image_styles.includes(style)
      if (has) {
        return { ...prev, image_styles: prev.image_styles.filter((s) => s !== style) }
      }
      if (prev.image_styles.length >= 3) return prev
      return { ...prev, image_styles: [...prev.image_styles, style] }
    })
  }

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const has = prev.posting_days.includes(day)
      if (has) {
        return { ...prev, posting_days: prev.posting_days.filter((d) => d !== day) }
      }
      return { ...prev, posting_days: [...prev.posting_days, day] }
    })
  }

  const addPostingTime = () => {
    const t = form.new_posting_time.trim()
    if (!t) return
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      setError('Posting time must be in HH:MM format')
      return
    }
    if (form.posting_times.includes(t)) {
      setForm((prev) => ({ ...prev, new_posting_time: '' }))
      return
    }
    setForm((prev) => ({
      ...prev,
      posting_times: [...prev.posting_times, t],
      new_posting_time: '',
    }))
  }

  const parseHashtags = (text: string): string[] => {
    const raw = text
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean)
    const normalized = raw.map((h) => (h.startsWith('#') ? h.slice(1) : h).toLowerCase())
    const unique = Array.from(new Set(normalized))
    return unique
  }

  const validateForm = (): string | null => {
    if (!form.ig_account_id) return 'Please select an Instagram account.'
    if (!form.display_name.trim()) return 'Display name is required.'
    if (!form.theme_id) return 'Please select a theme.'
    const inUseBy = themeUsage[form.theme_id]
    if (inUseBy && (!isEditing || identities.find((i) => i.id === form.id)?.theme_id !== form.theme_id)) {
      return `Theme is already assigned to ${inUseBy}.`
    }
    if (form.content_pillars.length < 2) return 'Select at least 2 content pillars.'
    if (form.posting_times.length < 1) return 'Add at least one posting time.'
    const hashtags = parseHashtags(form.hashtag_text)
    if (hashtags.length < 20) return 'Hashtag pool must contain at least 20 unique hashtags.'
    if (!form.voice_prompt.trim()) return 'Voice prompt cannot be empty.'
    return null
  }

  const handleSave = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const hashtags = parseHashtags(form.hashtag_text)
      const imageSubjects = form.image_subjects_raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const payload = {
        id: isEditing ? form.id : undefined,
        ig_account_id: form.ig_account_id,
        display_name: form.display_name.trim(),
        theme_id: form.theme_id,
        color_primary: form.color_primary,
        color_secondary: form.color_secondary,
        color_bg: form.color_bg,
        color_text: form.color_text,
        color_accent: form.color_accent,
        font_heading: form.font_heading,
        font_body: form.font_body,
        voice_prompt: form.voice_prompt,
        caption_style: form.caption_style,
        content_pillars: form.content_pillars,
        image_styles: form.image_styles,
        image_subjects: imageSubjects,
        posting_times: form.posting_times,
        posting_days: form.posting_days,
        posts_per_day: form.posts_per_day,
        carousel_ratio: form.carousel_ratio_percent / 100,
        hashtag_pool: hashtags,
        ghl_location_id: form.ghl_location_id.trim() || undefined,
        ghl_social_account_id: form.ghl_social_account_id.trim() || undefined,
        ghl_api_key: form.ghl_api_key.trim() || undefined,
      }

      const method = isEditing ? 'PATCH' : 'POST'
      const res = await fetch('/api/admin/identities', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save identity')
      }
      await loadData()
      setSelectedId(null)
      setForm(emptyFormState)
    } catch (e: any) {
      console.error('Save identity error:', e)
      setError(e.message || 'Failed to save identity')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateVoice = async () => {
    if (!form.theme_id) {
      setError('Select a theme before generating a voice prompt.')
      return
    }
    setSuggestingVoice(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/identities/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme_id: form.theme_id,
          caption_style: form.caption_style,
          content_pillars: form.content_pillars,
          display_name: form.display_name,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate voice prompt')
      }
      setForm((prev) => ({ ...prev, voice_prompt: data.voice_prompt || prev.voice_prompt }))
    } catch (e: any) {
      console.error('Voice suggestion error:', e)
      setError(e.message || 'Failed to generate voice prompt')
    } finally {
      setSuggestingVoice(false)
    }
  }

  const handleGenerateHashtags = async () => {
    if (form.content_pillars.length === 0) {
      setError('Select at least one content pillar before generating hashtags.')
      return
    }
    setGeneratingHashtags(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/identities/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_pillars: form.content_pillars,
          display_name: form.display_name,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate hashtags')
      }
      const hashtags: string[] = data.hashtags || []
      setForm((prev) => ({
        ...prev,
        hashtag_text: hashtags.map((h) => `#${h}`).join('\n'),
      }))
    } catch (e: any) {
      console.error('Hashtag generation error:', e)
      setError(e.message || 'Failed to generate hashtags')
    } finally {
      setGeneratingHashtags(false)
    }
  }

  const accountsForSelect = useMemo(() => {
    if (isEditing && form.ig_account_id) {
      const current = identities.find((i) => i.id === form.id)
      const currentAccount: IgAccount | undefined = current
        ? { id: current.ig_account_id || '', ig_username: current.ig_username || current.display_name }
        : undefined
      const rest = availableAccounts.filter((a) => a.id !== currentAccount?.id)
      return currentAccount ? [currentAccount, ...rest] : rest
    }
    return availableAccounts
  }, [availableAccounts, identities, isEditing, form.id, form.ig_account_id])

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* List view */}
      <div className="lg:w-1/2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Account Identities</h1>
            <p className="text-muted-foreground text-sm">
              Build visual and voice profiles for each Instagram account.
            </p>
          </div>
          <Button size="sm" onClick={startNew} disabled={loading || availableAccounts.length === 0}>
            <Palette className="h-4 w-4 mr-1" />
            New Identity
          </Button>
        </div>

        {/* Overall safety status */}
        <Card>
          <CardContent className="py-2 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {safetyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : safety?.summary.status === 'critical' ? (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
              )}
              <div>
                <div className="font-semibold">Safety status</div>
                <div className="text-muted-foreground">{safetyLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {safetyError && (
                <span className="text-[11px] text-red-400 max-w-[200px] truncate">
                  {safetyError}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={loadSafety}
                disabled={safetyLoading}
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Loading identities...
          </div>
        ) : identities.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No identities yet. Click &quot;New Identity&quot; to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {identities.map((id) => {
              const preset = THEME_PRESETS[id.theme_id] || null
              return (
                <Card
                  key={id.id}
                  className={cn(
                    'overflow-hidden cursor-pointer border border-border/60',
                    selectedId === id.id && 'ring-2 ring-primary'
                  )}
                  onClick={() => startEdit(id)}
                >
                  <div
                    className="h-20 w-full"
                    style={{
                      background: preset
                        ? `linear-gradient(135deg, ${preset.bg}, ${preset.surface})`
                        : id.color_bg,
                    }}
                  >
                    <div className="h-full w-full flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full"
                          style={{ backgroundColor: preset ? preset.accent : id.color_accent }}
                        />
                        <div
                          className="h-6 w-6 rounded-full"
                          style={{ backgroundColor: preset ? preset.accent2 : id.color_secondary }}
                        />
                      </div>
                      <span className="text-xs text-white/70 font-mono">
                        {id.theme_id || 'custom'}
                      </span>
                    </div>
                  </div>
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {id.display_name || id.ig_username || id.ig_account_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {id.caption_style} · {id.posts_per_day || 2} posts/day
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex flex-wrap justify-end gap-1">
                          {id.content_pillars.slice(0, 3).map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px]">
                              {p}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{id.posting_times.join(' · ') || 'No schedule'}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit form */}
      <div className="lg:w-1/2 space-y-4">
        {selectedId ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {isEditing ? 'Edit Identity' : 'New Identity'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Link an Instagram account and configure its full brand profile.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedId(null)
                  setForm(emptyFormState)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>

            <div className="space-y-4">
              {/* Section 1 — ACCOUNT LINK */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Account Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instagram Account</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={form.ig_account_id}
                      onChange={(e) => {
                        const id = e.target.value
                        const fromAvailable = availableAccounts.find((a) => a.id === id)
                        const fromIdentity = identities.find((i) => i.ig_account_id === id)
                        const account = fromAvailable ?? fromIdentity
                        setForm((prev) => ({
                          ...prev,
                          ig_account_id: id,
                          ...(account
                            ? {
                                ghl_location_id: account.ghl_location_id ?? '',
                                ghl_social_account_id: account.ghl_social_account_id ?? '',
                                ghl_api_key: account.ghl_api_key ?? '',
                              }
                            : {}),
                        }))
                      }}
                    >
                      <option value="">Select an account…</option>
                      {accountsForSelect.map((acct) => (
                        <option key={acct.id} value={acct.id}>
                          {acct.ig_username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Display Name</Label>
                    <Input
                      value={form.display_name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, display_name: e.target.value }))
                      }
                      placeholder="Account display name"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Go High Level (saved to ig_accounts) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Go High Level</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Optional. Saves to the linked Instagram account for publishing from Publish to GHL.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs">GHL Location ID</Label>
                    <Input
                      value={form.ghl_location_id}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, ghl_location_id: e.target.value }))
                      }
                      placeholder="Location ID for this sub-account"
                      type="text"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">GHL Social Account ID</Label>
                    <Input
                      value={form.ghl_social_account_id}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, ghl_social_account_id: e.target.value }))
                      }
                      placeholder="Social account ID (e.g. Facebook/IG connected)"
                      type="text"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">GHL API Key (location-level)</Label>
                    <Input
                      value={form.ghl_api_key}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, ghl_api_key: e.target.value }))
                      }
                      placeholder="Location access token for this sub-account"
                      type="password"
                      autoComplete="off"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Section 2 — VISUAL THEME */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Visual Theme
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(THEME_PRESETS).map(([id, t]) => {
                      const usedBy = themeUsage[id]
                      const disabled =
                        !!usedBy &&
                        (!isEditing ||
                          identities.find((i) => i.id === form.id)?.theme_id !== id)
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => !disabled && handleThemeSelect(id)}
                          className={cn(
                            'rounded-lg border p-2 text-left space-y-2 transition-colors',
                            form.theme_id === id && 'ring-2 ring-primary',
                            disabled && 'opacity-40 cursor-not-allowed'
                          )}
                        >
                          <div
                            className="h-16 rounded-md mb-1"
                            style={{
                              background: `linear-gradient(135deg, ${t.bg}, ${t.surface})`,
                            }}
                          >
                            <div className="flex items-center justify-between h-full px-3">
                              <div className="flex gap-1.5">
                                <span
                                  className="h-5 w-5 rounded-full"
                                  style={{ backgroundColor: t.accent }}
                                />
                                <span
                                  className="h-5 w-5 rounded-full"
                                  style={{ backgroundColor: t.accent2 }}
                                />
                              </div>
                              <span className="text-[10px] text-white/70 font-mono">
                                {t.fontHeading}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold">{id}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {t.fontHeading} / {t.fontBody}
                              </p>
                            </div>
                            {disabled && (
                              <Badge variant="outline" className="text-[9px]">
                                Used by {usedBy}
                              </Badge>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5">
                      <Label>Primary Color</Label>
                      <Input
                        value={form.color_primary}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, color_primary: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Accent Color</Label>
                      <Input
                        value={form.color_accent}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, color_accent: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Background</Label>
                      <Input
                        value={form.color_bg}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, color_bg: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Text Color</Label>
                      <Input
                        value={form.color_text}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, color_text: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Heading Font</Label>
                      <Input
                        value={form.font_heading}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, font_heading: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Body Font</Label>
                      <Input
                        value={form.font_body}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, font_body: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {form.theme_id &&
                    themeUsage[form.theme_id] &&
                    (!isEditing ||
                      identities.find((i) => i.id === form.id)?.theme_id !==
                        form.theme_id) && (
                      <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1">
                        Theme &quot;{form.theme_id}&quot; is already used by{' '}
                        {themeUsage[form.theme_id]}. Pick a different theme to avoid visual
                        fingerprinting.
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* Section 3 — VOICE & TONE */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Voice &amp; Tone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5 text-xs">
                    <Label>Caption Style</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={form.caption_style}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          caption_style: e.target.value as CaptionStyle,
                        }))
                      }
                    >
                      <option value="punchy-short">Punchy · Short</option>
                      <option value="editorial-long">Editorial · Long</option>
                      <option value="data-driven">Data-driven</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Label>Voice Prompt</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateVoice}
                        disabled={suggestingVoice}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {suggestingVoice ? 'Generating…' : 'Generate suggestion'}
                      </Button>
                    </div>
                    <Textarea
                      rows={6}
                      value={form.voice_prompt}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, voice_prompt: e.target.value }))
                      }
                      placeholder="Describe how this account should sound: tone, pacing, references, language, etc."
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <Label>Content Pillars (select 2–3)</Label>
                    <div className="flex flex-wrap gap-2">
                      {CONTENT_PILLARS.map((pillar) => {
                        const selected = form.content_pillars.includes(pillar)
                        const disabled =
                          !selected && form.content_pillars.length >= 3
                        return (
                          <button
                            key={pillar}
                            type="button"
                            disabled={disabled}
                            onClick={() => togglePillar(pillar)}
                            className={cn(
                              'px-2 py-1 rounded-full border text-[11px] transition-colors',
                              selected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                              disabled && 'opacity-40 cursor-not-allowed'
                            )}
                          >
                            {pillar}
                          </button>
                        )
                      })}
                    </div>
                    {currentPillarOverlap && (
                      <div className="text-[11px] text-yellow-100 bg-yellow-500/10 border border-yellow-500/30 rounded-md px-2 py-1">
                        Another account shares more than one content pillar with this
                        identity. Adjust the mix so each account has a unique pillar stack.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Section 4 — IMAGE GENERATION */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Image Generation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-xs">
                    <Label>Image Styles (2–3)</Label>
                    <div className="flex flex-wrap gap-2">
                      {IMAGE_STYLES.map((style) => {
                        const selected = form.image_styles.includes(style)
                        const disabled =
                          !selected && form.image_styles.length >= 3
                        return (
                          <button
                            key={style}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleImageStyle(style)}
                            className={cn(
                              'px-2 py-1 rounded-full border text-[11px] transition-colors capitalize',
                              selected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                              disabled && 'opacity-40 cursor-not-allowed'
                            )}
                          >
                            {style}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <Label>Image Subjects</Label>
                    <Textarea
                      rows={3}
                      value={form.image_subjects_raw}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          image_subjects_raw: e.target.value,
                        }))
                      }
                      placeholder="recording studio, mixing console, vintage vinyl, headphones on desk"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Section 5 — POSTING SCHEDULE */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Posting Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label>Posting Times</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="21:00"
                        className="w-32"
                        value={form.new_posting_time}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            new_posting_time: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addPostingTime()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPostingTime}
                      >
                        Add time
                      </Button>
                    </div>
                    {!!form.posting_times.length && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {form.posting_times.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="text-[10px] cursor-pointer"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                posting_times: prev.posting_times.filter(
                                  (x) => x !== t
                                ),
                              }))
                            }
                          >
                            {t} ✕
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Posting Days</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const selected = form.posting_days.includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={cn(
                              'px-2 py-1 rounded-full border text-[11px] transition-colors',
                              selected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Posts per day</Label>
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        value={form.posts_per_day}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            posts_per_day: Math.max(
                              1,
                              Math.min(3, Number(e.target.value) || 1)
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Carousel ratio</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[form.carousel_ratio_percent]}
                          min={0}
                          max={100}
                          step={5}
                          onValueChange={([val]) =>
                            setForm((prev) => ({
                              ...prev,
                              carousel_ratio_percent: val,
                            }))
                          }
                        />
                        <span className="text-[11px] text-muted-foreground min-w-[52px]">
                          {form.carousel_ratio_percent}% carousel
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 6 — HASHTAG POOL */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Hashtag Pool
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      One hashtag per line or comma-separated. Aim for 30–40.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateHashtags}
                      disabled={generatingHashtags}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {generatingHashtags ? 'Generating…' : 'Auto-generate'}
                    </Button>
                  </div>
                  <Textarea
                    rows={5}
                    value={form.hashtag_text}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, hashtag_text: e.target.value }))
                    }
                    placeholder="#synclicensing #musiccatalog ..."
                  />

                  {currentHashtagOverlap && (
                    <div className="text-[11px] text-yellow-100 bg-yellow-500/10 border border-yellow-500/30 rounded-md px-2 py-1">
                      This account shares {currentHashtagOverlap.count} hashtags with other
                      identities. Consider diversifying hashtags to reduce cross-account
                      overlap.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedId(null)
                    setForm(emptyFormState)
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Identity'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden lg:flex items-center justify-center h-full text-muted-foreground text-sm">
            Select an identity on the left or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  )
}

