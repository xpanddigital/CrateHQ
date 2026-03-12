'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  CheckCircle,
  Loader2,
  Upload,
  Database,
  Tag as TagIcon,
  FileCheck,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Link as LinkIcon,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedArtist {
  spotify_url: string
  name: string
  monthly_listeners: number
  spotify_followers: number
  spotify_verified: boolean
  biography: string | null
  image_url: string | null
  country: string | null
  world_rank: number
  top_track_streams: number
  track_count: number
  instagram_handle: string | null
  social_links: Record<string, string>
  genres: string[]
  popularity: number | null
  // Preview flags
  has_instagram: boolean
  has_youtube: boolean
  has_website: boolean
  has_bio: boolean
  // UI state
  spotify_id: string
  selected: boolean
}

type RunStatus = 'idle' | 'running' | 'succeeded' | 'failed'

// ─── Transform Apify output to ScrapedArtist ──────────────────────────────────

function transformItem(item: any, genreItem?: any): ScrapedArtist {
  const socialLinks: Record<string, string> = {}
  let instagramHandle: string | null = null

  for (const link of item.externalLinks || []) {
    const label = (link.label || '').toLowerCase().trim()
    const url = link.url || ''
    if (label === 'instagram') {
      socialLinks.instagram = url
      instagramHandle = url
        .replace(/https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/$/, '')
        .split('?')[0]
        .split('/')[0]
    } else if (label === 'youtube') {
      socialLinks.youtube = url
    } else if (label === 'facebook') {
      socialLinks.facebook = url
    } else if (label === 'twitter' || label === 'x') {
      socialLinks.twitter = url
    } else if (label === 'wikipedia') {
      socialLinks.wikipedia = url
    } else if (label === 'website' || label === 'homepage') {
      socialLinks.website = url
    }
  }

  const topTrackStreams = (item.topTracks || [])
    .reduce((sum: number, t: any) => sum + (t.streamCount || 0), 0)

  const trackCount = (item.albums?.length || 0) + (item.singles?.length || 0)

  const spotifyUrl = item._url || item.url || ''
  const spotifyIdMatch = spotifyUrl.match(/artist\/([a-zA-Z0-9]+)/)
  const spotifyId = spotifyIdMatch ? spotifyIdMatch[1] : spotifyUrl

  return {
    spotify_url: spotifyUrl,
    spotify_id: spotifyId,
    name: item.name || '',
    monthly_listeners: item.monthlyListeners || 0,
    spotify_followers: item.followers || 0,
    spotify_verified: item.verified || false,
    biography: item.biography || null,
    image_url: item.coverArt?.[0]?.url || null,
    country: item.topCities?.[0]?.country || null,
    world_rank: item.worldRank || 0,
    top_track_streams: topTrackStreams,
    track_count: trackCount,
    instagram_handle: instagramHandle,
    social_links: socialLinks,
    genres: genreItem?.genres || [],
    popularity: genreItem?.popularity || null,
    has_instagram: !!instagramHandle,
    has_youtube: !!socialLinks.youtube,
    has_website: !!(socialLinks.website || socialLinks.homepage),
    has_bio: !!item.biography,
    selected: true,
  }
}

function extractSpotifyUrl(text: string): string | null {
  const match = text.match(/https?:\/\/open\.spotify\.com\/artist\/[a-zA-Z0-9]+/)
  return match ? match[0] : null
}

function deduplicateUrls(urls: string[]): string[] {
  return [...new Set(urls.map(u => u.trim()).filter(Boolean))]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScrapingPage() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingConfig, setCheckingConfig] = useState(true)
  const [apifyConfigured, setApifyConfigured] = useState(false)

  // Step 1 — URL Collection
  const [pastedUrls, setPastedUrls] = useState('')
  const [collectedUrls, setCollectedUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 — Core Data
  const [coreRunId, setCoreRunId] = useState('')
  const [coreDatasetId, setCoreDatasetId] = useState('')
  const [coreStatus, setCoreStatus] = useState<RunStatus>('idle')
  const [coreProgress, setCoreProgress] = useState('')
  const [coreItems, setCoreItems] = useState<any[]>([])

  // Step 3 — Genre Enrichment
  const [genreRunId, setGenreRunId] = useState('')
  const [genreDatasetId, setGenreDatasetId] = useState('')
  const [genreStatus, setGenreStatus] = useState<RunStatus>('idle')
  const [genreProgress, setGenreProgress] = useState('')

  // Step 4 — Review & Import
  const [artists, setArtists] = useState<ScrapedArtist[]>([])
  const [minListeners, setMinListeners] = useState('')
  const [maxListeners, setMaxListeners] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Rescrape All
  const [rescrapeRunId, setRescrapeRunId] = useState('')
  const [rescrapeStatus, setRescrapeStatus] = useState<RunStatus>('idle')
  const [rescrapeResult, setRescrapeResult] = useState<any>(null)

  // Actor IDs (from localStorage settings)
  const [coreActorId, setCoreActorIdState] = useState('YZhD6hYc8daYSWXKs')
  const [genreActorId, setGenreActorIdState] = useState('vJZ1EOCOEVCsENnWh')

  useEffect(() => {
    checkSetup()
    fetchTags()
    // Load actor ID overrides from localStorage
    const savedCore = localStorage.getItem('apify_core_actor_id')
    const savedGenre = localStorage.getItem('apify_genre_actor_id')
    if (savedCore) setCoreActorIdState(savedCore)
    if (savedGenre) setGenreActorIdState(savedGenre)
  }, [])

  const checkSetup = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(profile?.role === 'admin')

      const res = await fetch('/api/integrations/check-apify')
      const data = await res.json()
      setApifyConfigured(data.configured || false)
    } catch {
      setIsAdmin(false)
    } finally {
      setCheckingConfig(false)
    }
  }

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (data.tags) setAvailableTags(data.tags)
    } catch {}
  }

  // ─── Polling ──────────────────────────────────────────────────────────────

  const pollStatus = useCallback(async (
    runId: string,
    onRunning: (msg: string) => void,
    onSucceeded: (datasetId: string) => void,
    onFailed: (msg: string) => void,
  ) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scraping/status?runId=${runId}`)
        const data = await res.json()
        const status = data.status

        if (status === 'RUNNING' || status === 'READY') {
          onRunning(`Running... (${status})`)
        } else if (status === 'SUCCEEDED') {
          clearInterval(interval)
          onSucceeded(data.datasetId)
        } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          clearInterval(interval)
          onFailed(`Run ${status.toLowerCase()}`)
        }
      } catch (err) {
        clearInterval(interval)
        onFailed('Status check failed')
      }
    }, 5000)
  }, [])

  const fetchResults = useCallback(async (datasetId: string): Promise<any[]> => {
    const res = await fetch(`/api/scraping/results?datasetId=${datasetId}`)
    if (!res.ok) throw new Error('Failed to fetch results')
    const data = await res.json()
    return data.items || []
  }, [])

  // ─── Step 1: Collect URLs ─────────────────────────────────────────────────

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n')
      const found: string[] = []
      for (const line of lines) {
        const cells = line.split(',')
        for (const cell of cells) {
          const url = extractSpotifyUrl(cell.trim().replace(/"/g, ''))
          if (url) found.push(url)
        }
      }
      setPastedUrls(prev => [prev, ...found].filter(Boolean).join('\n'))
      toast({ title: `Extracted ${found.length} Spotify URLs from CSV` })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCollectUrls = () => {
    const lines = pastedUrls.split('\n')
    const urls: string[] = []
    for (const line of lines) {
      const url = extractSpotifyUrl(line.trim())
      if (url) urls.push(url)
    }
    const deduped = deduplicateUrls(urls)
    if (deduped.length === 0) {
      toast({ title: 'No valid Spotify artist URLs found', variant: 'destructive' })
      return
    }
    setCollectedUrls(deduped)
    setCurrentStep(2)
  }

  // ─── Step 2: Core Data ────────────────────────────────────────────────────

  const handleStartCoreData = async () => {
    setCoreStatus('running')
    setCoreProgress('Starting run...')
    try {
      const res = await fetch('/api/scraping/core-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: collectedUrls, actorId: coreActorId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const { runId, datasetId } = await res.json()
      setCoreRunId(runId)
      setCoreDatasetId(datasetId)

      pollStatus(
        runId,
        (msg) => setCoreProgress(msg),
        async (dsId) => {
          setCoreProgress('Fetching results...')
          const items = await fetchResults(dsId)
          setCoreItems(items)
          setCoreStatus('succeeded')
          setCoreProgress(`Scraped ${items.length} artists`)
          setCurrentStep(3)
        },
        (msg) => {
          setCoreStatus('failed')
          setCoreProgress(msg)
          toast({ title: `Core data scrape failed: ${msg}`, variant: 'destructive' })
        },
      )
    } catch (err: any) {
      setCoreStatus('failed')
      setCoreProgress(err.message)
      toast({ title: err.message, variant: 'destructive' })
    }
  }

  // ─── Step 3: Genre Enrichment ─────────────────────────────────────────────

  const handleStartGenres = async () => {
    setGenreStatus('running')
    setGenreProgress('Starting run...')
    try {
      const res = await fetch('/api/scraping/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: collectedUrls, actorId: genreActorId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const { runId, datasetId } = await res.json()
      setGenreRunId(runId)
      setGenreDatasetId(datasetId)

      pollStatus(
        runId,
        (msg) => setGenreProgress(msg),
        async (dsId) => {
          setGenreProgress('Fetching results...')
          const genreItems = await fetchResults(dsId)
          setGenreStatus('succeeded')
          setGenreProgress(`Enriched ${genreItems.length} artists`)
          buildReviewTable(coreItems, genreItems)
        },
        (msg) => {
          setGenreStatus('failed')
          setGenreProgress(msg)
          toast({ title: `Genre enrichment failed: ${msg}. Proceeding without genres.`, variant: 'default' })
          buildReviewTable(coreItems, [])
        },
      )
    } catch (err: any) {
      setGenreStatus('failed')
      setGenreProgress(err.message)
      buildReviewTable(coreItems, [])
    }
  }

  const handleSkipGenres = () => {
    buildReviewTable(coreItems, [])
  }

  const buildReviewTable = (core: any[], genreItems: any[]) => {
    // Build genre lookup by Spotify ID
    const genreMap = new Map<string, any>()
    for (const g of genreItems) {
      const url = g._url || g.url || ''
      const match = url.match(/artist\/([a-zA-Z0-9]+)/)
      if (match) genreMap.set(match[1], g)
    }

    const merged = core.map(item => {
      const spotifyUrl = item._url || item.url || ''
      const match = spotifyUrl.match(/artist\/([a-zA-Z0-9]+)/)
      const spotifyId = match ? match[1] : ''
      return transformItem(item, genreMap.get(spotifyId))
    })

    setArtists(merged)
    setCurrentStep(4)
  }

  // ─── Step 4: Import ───────────────────────────────────────────────────────

  const filteredArtists = artists.filter(a => {
    const min = parseInt(minListeners) || 0
    const max = parseInt(maxListeners) || Infinity
    return a.monthly_listeners >= min && a.monthly_listeners <= max
  })

  const selectedArtists = filteredArtists.filter(a => a.selected)

  const handleImport = async () => {
    if (selectedArtists.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/scraping/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artists: selectedArtists, tagIds: selectedTags }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Import failed')
      const data = await res.json()
      setImportResult(data)
      toast({ title: `Imported ${data.imported} artists` })
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  // ─── Rescrape All ─────────────────────────────────────────────────────────

  const handleRescrapeAll = async () => {
    if (!confirm('Re-scrape all existing artists? This updates stream counts and listeners. May take 10-15+ minutes.')) return
    setRescrapeStatus('running')
    setRescrapeResult(null)
    try {
      const res = await fetch('/api/scraping/rescrape-all', { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const { runId, datasetId, total } = await res.json()
      setRescrapeRunId(runId)
      toast({ title: `Re-scrape started for ${total} artists. Polling for completion...` })

      pollStatus(
        runId,
        () => {},
        async (dsId) => {
          const items = await fetchResults(dsId)
          const applyRes = await fetch('/api/scraping/rescrape-all', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          })
          const result = await applyRes.json()
          setRescrapeStatus('succeeded')
          setRescrapeResult(result)
          toast({ title: `Re-scrape complete: ${result.updated} updated` })
        },
        (msg) => {
          setRescrapeStatus('failed')
          toast({ title: `Re-scrape failed: ${msg}`, variant: 'destructive' })
        },
      )
    } catch (err: any) {
      setRescrapeStatus('failed')
      toast({ title: err.message, variant: 'destructive' })
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (checkingConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Scraping Dashboard</h1>
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            This page is only accessible to administrators.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!apifyConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Scraping Dashboard</h1>
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <p className="font-semibold">Apify Not Configured</p>
            <p className="text-sm text-muted-foreground">
              Add <code className="bg-muted px-1 rounded">APIFY_TOKEN</code> to your environment variables.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const steps = [
    { number: 1, title: 'Collect URLs', icon: LinkIcon },
    { number: 2, title: 'Core Data', icon: Database },
    { number: 3, title: 'Genre Enrichment', icon: TagIcon },
    { number: 4, title: 'Review & Import', icon: FileCheck },
  ]

  const withInstagram = filteredArtists.filter(a => a.has_instagram).length
  const withYouTube = filteredArtists.filter(a => a.has_youtube).length
  const withSocial = filteredArtists.filter(a => a.has_instagram || a.has_youtube || a.has_website).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scraping Dashboard</h1>
          <p className="text-muted-foreground">Artist discovery and enrichment pipeline</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRescrapeAll}
          disabled={rescrapeStatus === 'running'}
        >
          {rescrapeStatus === 'running' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Re-scraping...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" />Re-scrape All Artists</>
          )}
        </Button>
      </div>

      {/* Rescrape result */}
      {rescrapeResult && (
        <Card>
          <CardContent className="pt-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-600">
                Re-scrape complete — {rescrapeResult.updated} updated, {rescrapeResult.failed} failed
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full border-2 ${
                    currentStep > step.number
                      ? 'bg-green-500 border-green-500 text-white'
                      : currentStep === step.number
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted text-muted-foreground'
                  }`}>
                    {currentStep > step.number
                      ? <CheckCircle className="h-6 w-6" />
                      : <step.icon className="h-6 w-6" />}
                  </div>
                  <p className="text-xs font-medium mt-2 text-center w-20">{step.title}</p>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-6 w-6 mx-2 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Step 1: Collect URLs ── */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Collect Spotify Artist URLs</CardTitle>
            <CardDescription>
              Paste URLs or upload a CSV. One Spotify artist URL per line.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Spotify Artist URLs</Label>
              <Textarea
                placeholder="https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4&#10;https://open.spotify.com/artist/..."
                value={pastedUrls}
                onChange={(e) => setPastedUrls(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                One URL per line. Non-URL lines are ignored. Duplicates are removed automatically.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <p className="text-xs text-muted-foreground">
                CSV columns containing Spotify artist URLs will be extracted automatically.
              </p>
            </div>

            <Button
              onClick={handleCollectUrls}
              disabled={!pastedUrls.trim()}
              className="w-full"
              size="lg"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Proceed to Core Data Scrape
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Core Data ── */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Core Data Scrape</CardTitle>
            <CardDescription>
              Fetches streams, listeners, social links, bio, and top tracks from Spotify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <strong>{collectedUrls.length}</strong> artist URLs ready
              <span className="text-muted-foreground ml-2">· Actor: {coreActorId}</span>
            </div>

            {coreStatus === 'running' && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                {coreProgress}
              </div>
            )}
            {coreStatus === 'succeeded' && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                {coreProgress}
              </div>
            )}
            {coreStatus === 'failed' && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {coreProgress}
              </div>
            )}

            {coreStatus === 'idle' && (
              <Button onClick={handleStartCoreData} className="w-full" size="lg">
                <Database className="h-4 w-4 mr-2" />
                Start Core Data Scrape
              </Button>
            )}
            {coreStatus === 'running' && (
              <Button disabled className="w-full" size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Polling for results every 5s...
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Genre Enrichment ── */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Genre Enrichment <Badge variant="outline" className="ml-2">Optional</Badge></CardTitle>
            <CardDescription>
              Adds genre tags and popularity scores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-700">Known reliability issues</p>
                <p className="text-muted-foreground mt-1">
                  This actor ({genreActorId}) has a ~65% failure rate. Results may be partial or missing.
                  You can skip this step — genres can be added manually later.
                </p>
              </div>
            </div>

            {genreStatus === 'running' && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                {genreProgress}
              </div>
            )}
            {genreStatus === 'succeeded' && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                {genreProgress}
              </div>
            )}
            {(genreStatus === 'failed') && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {genreProgress} — proceeding without genres
              </div>
            )}

            {genreStatus === 'idle' && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleSkipGenres}>
                  Skip This Step
                </Button>
                <Button className="flex-1" onClick={handleStartGenres}>
                  <TagIcon className="h-4 w-4 mr-2" />
                  Try Genre Enrichment
                </Button>
              </div>
            )}
            {genreStatus === 'running' && (
              <Button disabled className="w-full" size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Polling for results every 5s...
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Review & Import ── */}
      {currentStep === 4 && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Artists', value: filteredArtists.length },
              { label: 'With Instagram', value: withInstagram },
              { label: 'With YouTube', value: withYouTube },
              { label: 'With Social Links', value: withSocial },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Review & Import ({selectedArtists.length} selected)</CardTitle>
              <CardDescription>Filter, deselect, and tag artists before importing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Monthly Listeners</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 1000"
                    value={minListeners}
                    onChange={e => setMinListeners(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Monthly Listeners</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 500000"
                    value={maxListeners}
                    onChange={e => setMaxListeners(e.target.value)}
                    className="w-40"
                  />
                </div>
                {(minListeners || maxListeners) && (
                  <Button variant="ghost" size="sm" onClick={() => { setMinListeners(''); setMaxListeners('') }}>
                    Clear filter
                  </Button>
                )}
              </div>

              {/* Tags */}
              {availableTags.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Auto-Apply Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        style={selectedTags.includes(tag.id)
                          ? { backgroundColor: tag.color }
                          : { borderColor: tag.color, color: tag.color }}
                        onClick={() => setSelectedTags(prev =>
                          prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                        )}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="border rounded-lg max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredArtists.length > 0 && filteredArtists.every(a => a.selected)}
                          onCheckedChange={(checked) => {
                            const ids = new Set(filteredArtists.map(a => a.spotify_id))
                            setArtists(prev => prev.map(a =>
                              ids.has(a.spotify_id) ? { ...a, selected: !!checked } : a
                            ))
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Monthly Listeners</TableHead>
                      <TableHead>Top Streams</TableHead>
                      <TableHead>Tracks</TableHead>
                      <TableHead>Genres</TableHead>
                      <TableHead>Social</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArtists.map(artist => (
                      <TableRow key={artist.spotify_id}>
                        <TableCell>
                          <Checkbox
                            checked={artist.selected}
                            onCheckedChange={() =>
                              setArtists(prev => prev.map(a =>
                                a.spotify_id === artist.spotify_id ? { ...a, selected: !a.selected } : a
                              ))
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-[160px] truncate">{artist.name}</TableCell>
                        <TableCell>{artist.monthly_listeners.toLocaleString()}</TableCell>
                        <TableCell>{(artist.top_track_streams / 1_000_000).toFixed(1)}M</TableCell>
                        <TableCell>{artist.track_count}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">
                          {artist.genres.slice(0, 2).join(', ') || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {artist.has_instagram && <Badge variant="outline" className="text-xs px-1">IG</Badge>}
                            {artist.has_youtube && <Badge variant="outline" className="text-xs px-1">YT</Badge>}
                            {artist.has_website && <Badge variant="outline" className="text-xs px-1">Web</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Import result */}
              {importResult && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <p className="font-semibold text-green-600">Import Complete!</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Imported</p><p className="font-bold">{importResult.imported}</p></div>
                    <div><p className="text-muted-foreground">Duplicates</p><p className="font-bold">{importResult.skipped}</p></div>
                    <div><p className="text-muted-foreground">Failed</p><p className="font-bold">{importResult.failed ?? 0}</p></div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={importing || selectedArtists.length === 0}
                className="w-full"
                size="lg"
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                ) : (
                  `Import ${selectedArtists.length} Artists`
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
