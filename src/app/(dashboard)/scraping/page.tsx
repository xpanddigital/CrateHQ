'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { CheckCircle, Loader2, Search, Database, Tag as TagIcon, FileCheck, ChevronRight, Download } from 'lucide-react'

interface ArtistData {
  spotify_id: string
  name: string
  spotify_url: string
  monthlyListeners: number
  topTrackStreams: number
  trackCount: number
  genres: string[]
  hasInstagram: boolean
  hasYouTube: boolean
  hasWebsite: boolean
  hasBio: boolean
  selected: boolean
  // Full data for import
  rawData: any
}

export default function ScrapingPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [apifyConfigured, setApifyConfigured] = useState(false)
  const [checkingConfig, setCheckingConfig] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Step 1: Discovery
  const [keywords, setKeywords] = useState('')
  const [maxResults, setMaxResults] = useState('50')
  const [pastedUrls, setPastedUrls] = useState('')
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  
  // Step 2: Core Data
  const [coreData, setCoreData] = useState<Record<string, any>>({})
  const [scrapingCore, setScrapingCore] = useState(false)
  
  // Step 3: Genres
  const [genreData, setGenreData] = useState<Record<string, any>>({})
  const [scrapingGenres, setScrapingGenres] = useState(false)
  
  // Step 4: Review & Import
  const [artists, setArtists] = useState<ArtistData[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  useEffect(() => {
    checkApifyConfig()
    checkAdminRole()
  }, [])

  const checkAdminRole = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        setIsAdmin(profile?.role === 'admin')
      }
    } catch (error) {
      setIsAdmin(false)
    }
  }

  const checkApifyConfig = async () => {
    try {
      const res = await fetch('/api/integrations/check-apify')
      const data = await res.json()
      setApifyConfigured(data.configured || false)
    } catch (error) {
      setApifyConfigured(false)
    } finally {
      setCheckingConfig(false)
    }
  }

  const steps = [
    { number: 1, title: 'Discover Artists', icon: Search },
    { number: 2, title: 'Core Data Scrape', icon: Database },
    { number: 3, title: 'Genre Enrichment', icon: TagIcon },
    { number: 4, title: 'Review & Import', icon: FileCheck },
  ]

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      // Parse keywords or use pasted URLs
      let urls: string[] = []
      
      if (pastedUrls.trim()) {
        urls = pastedUrls.split('\n').map(u => u.trim()).filter(Boolean)
        setDiscoveredUrls(urls)
        setCurrentStep(2)
      } else if (keywords.trim()) {
        const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
        
        const res = await fetch('/api/scraping/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: keywordList,
            maxResults: parseInt(maxResults) || 50,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Discovery failed')
        }
        
        const data = await res.json()
        urls = data.urls || []
        
        setDiscoveredUrls(urls)
        if (urls.length > 0) {
          setCurrentStep(2)
        }
      }
    } catch (error: any) {
      console.error('Discovery error:', error)
      alert(error.message || 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const handleScrapeCore = async () => {
    setScrapingCore(true)
    try {
      const res = await fetch('/api/scraping/core-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: discoveredUrls }),
      })

      if (!res.ok) throw new Error('Core data scraping failed')
      
      const data = await res.json()
      setCoreData(data.results || {})
      setCurrentStep(3)
    } catch (error) {
      console.error('Core scraping error:', error)
    } finally {
      setScrapingCore(false)
    }
  }

  const handleScrapeGenres = async () => {
    setScrapingGenres(true)
    try {
      const res = await fetch('/api/scraping/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: discoveredUrls }),
      })

      if (!res.ok) throw new Error('Genre scraping failed')
      
      const data = await res.json()
      setGenreData(data.results || {})
      
      // Merge and prepare for review
      prepareReviewData()
    } catch (error) {
      console.error('Genre scraping error:', error)
    } finally {
      setScrapingGenres(false)
    }
  }

  const handleSkipGenres = () => {
    prepareReviewData()
  }

  const prepareReviewData = () => {
    const merged: ArtistData[] = []
    
    for (const [spotifyId, core] of Object.entries(coreData)) {
      const genre = genreData[spotifyId] || {}
      
      merged.push({
        spotify_id: spotifyId,
        name: core.name || '',
        spotify_url: core._url || '',
        monthlyListeners: core.monthlyListeners || 0,
        topTrackStreams: core.topTrackStreams || 0,
        trackCount: core.trackCount || 0,
        genres: genre.genres || [],
        hasInstagram: !!core.instagram_handle,
        hasYouTube: !!core.social_links?.youtube,
        hasWebsite: !!core.social_links?.website,
        hasBio: !!core.biography,
        selected: true,
        rawData: { ...core, ...genre },
      })
    }
    
    setArtists(merged)
    setCurrentStep(4)
    fetchTags()
  }

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (data.tags) setAvailableTags(data.tags)
    } catch (error) {
      console.error('Error fetching tags:', error)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const selectedArtists = artists.filter(a => a.selected)
      
      const res = await fetch('/api/scraping/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artists: selectedArtists.map(a => a.rawData),
          tagIds: selectedTags,
        }),
      })

      if (!res.ok) throw new Error('Import failed')
      
      const data = await res.json()
      setImportResult(data)
    } catch (error) {
      console.error('Import error:', error)
    } finally {
      setImporting(false)
    }
  }

  const toggleArtist = (spotifyId: string) => {
    setArtists(prev => prev.map(a => 
      a.spotify_id === spotifyId ? { ...a, selected: !a.selected } : a
    ))
  }

  const selectedCount = artists.filter(a => a.selected).length
  const withInstagram = artists.filter(a => a.hasInstagram).length
  const withYouTube = artists.filter(a => a.hasYouTube).length
  const withEmailFindable = artists.filter(a => a.hasWebsite || a.hasBio).length

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
        <div>
          <h1 className="text-3xl font-bold">Scraping Dashboard</h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              This page is only accessible to administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!apifyConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Scraping Dashboard</h1>
          <p className="text-muted-foreground">
            Multi-stage artist discovery and data enrichment pipeline
          </p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Apify Not Configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add APIFY_TOKEN to your .env.local file to enable scraping features
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-xs font-mono mb-2">
                APIFY_TOKEN=your_apify_token_here
              </p>
              <p className="text-xs text-muted-foreground">
                Get your token from: https://console.apify.com/account/integrations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scraping Dashboard</h1>
        <p className="text-muted-foreground">
          Multi-stage artist discovery and data enrichment pipeline
        </p>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center h-12 w-12 rounded-full border-2 ${
                      currentStep >= step.number
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>
                  <p className="text-xs font-medium mt-2 text-center">
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-6 w-6 mx-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Discover */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Discover Artists</CardTitle>
            <CardDescription>
              Search for artists by keywords or paste Spotify URLs directly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search Keywords</Label>
              <Input
                placeholder="indie hip hop, alternative R&B, underground rap"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated keywords to search Spotify
              </p>
              <p className="text-xs text-yellow-600">
                Note: Actor input format may vary. Verify in Apify docs if discovery fails.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Max Results Per Keyword</Label>
              <Input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                placeholder="50"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Paste Spotify URLs</Label>
              <Textarea
                placeholder="https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4&#10;https://open.spotify.com/artist/..."
                value={pastedUrls}
                onChange={(e) => setPastedUrls(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                One URL per line (skips discovery step)
              </p>
            </div>

            {discoveredUrls.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-semibold text-green-500">
                    Found {discoveredUrls.length} artist URLs
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleDiscover}
              disabled={discovering || (!keywords && !pastedUrls)}
              className="w-full"
              size="lg"
            >
              {discovering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Start Discovery
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Core Data */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Core Data Scrape</CardTitle>
            <CardDescription>
              Scrape detailed streaming data, social links, and biography
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <strong>{discoveredUrls.length}</strong> artist URLs ready to scrape
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This will fetch: streams, listeners, social links, bio, albums, singles
              </p>
            </div>

            {Object.keys(coreData).length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-semibold text-green-500">
                    Scraped {Object.keys(coreData).length} artists
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleScrapeCore}
              disabled={scrapingCore}
              className="w-full"
              size="lg"
            >
              {scrapingCore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scraping Core Data...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Scrape Core Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Genres */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Genre Enrichment</CardTitle>
            <CardDescription>
              Optional: Add genre data and popularity scores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <strong>{Object.keys(coreData).length}</strong> artists ready for genre enrichment
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This adds genre tags and popularity metrics
              </p>
            </div>

            {Object.keys(genreData).length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-semibold text-green-500">
                    Enriched {Object.keys(genreData).length} artists with genres
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSkipGenres}
                variant="outline"
                className="flex-1"
              >
                Skip This Step
              </Button>
              <Button
                onClick={handleScrapeGenres}
                disabled={scrapingGenres}
                className="flex-1"
              >
                {scrapingGenres ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <TagIcon className="h-4 w-4 mr-2" />
                    Enrich Genres
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Import */}
      {currentStep === 4 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Summary Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Artists</p>
                  <p className="text-2xl font-bold">{artists.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">With Instagram</p>
                  <p className="text-2xl font-bold">{withInstagram}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">With YouTube</p>
                  <p className="text-2xl font-bold">{withYouTube}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email-Findable</p>
                  <p className="text-2xl font-bold">{withEmailFindable}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review & Import ({selectedCount} selected)</CardTitle>
              <CardDescription>
                Review scraped artists and select tags to apply
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Auto-Apply Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      style={
                        selectedTags.includes(tag.id)
                          ? { backgroundColor: tag.color }
                          : { borderColor: tag.color, color: tag.color }
                      }
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag.id)
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCount === artists.length}
                          onCheckedChange={() => {
                            const allSelected = selectedCount === artists.length
                            setArtists(prev => prev.map(a => ({ ...a, selected: !allSelected })))
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Listeners</TableHead>
                      <TableHead>Tracks</TableHead>
                      <TableHead>Genres</TableHead>
                      <TableHead>Social</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {artists.map((artist) => (
                      <TableRow key={artist.spotify_id}>
                        <TableCell>
                          <Checkbox
                            checked={artist.selected}
                            onCheckedChange={() => toggleArtist(artist.spotify_id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{artist.name}</TableCell>
                        <TableCell>{artist.monthlyListeners.toLocaleString()}</TableCell>
                        <TableCell>{artist.trackCount}</TableCell>
                        <TableCell className="text-xs">
                          {artist.genres.slice(0, 2).join(', ') || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {artist.hasInstagram && <Badge variant="outline">IG</Badge>}
                            {artist.hasYouTube && <Badge variant="outline">YT</Badge>}
                            {artist.hasWebsite && <Badge variant="outline">Web</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {importResult && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <p className="font-semibold text-green-500">Import Complete!</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Imported</p>
                      <p className="font-bold">{importResult.imported}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duplicates</p>
                      <p className="font-bold">{importResult.skipped}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Failed</p>
                      <p className="font-bold">{importResult.failed || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="w-full"
                size="lg"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${selectedCount} Artists`
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
