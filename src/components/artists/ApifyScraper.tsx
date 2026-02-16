'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Search, CheckCircle, AlertCircle } from 'lucide-react'

interface ScrapedArtist {
  name: string
  spotify_url?: string
  spotify_monthly_listeners?: number
  image_url?: string
  genres?: string[]
}

export function ApifyScraper() {
  const router = useRouter()
  const [keywords, setKeywords] = useState('')
  const [playlistUrls, setPlaylistUrls] = useState('')
  const [maxResults, setMaxResults] = useState('50')
  const [actorId, setActorId] = useState('epctex/spotify-scraper')
  
  const [scraping, setScraping] = useState(false)
  const [polling, setPolling] = useState(false)
  const [importing, setImporting] = useState(false)
  const [runId, setRunId] = useState('')
  const [results, setResults] = useState<ScrapedArtist[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleStartScrape = async () => {
    setError('')
    setScraping(true)

    try {
      const res = await fetch('/api/artists/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          playlistUrls: playlistUrls.split('\n').map(u => u.trim()).filter(Boolean),
          maxResults: parseInt(maxResults) || 50,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start scraping')
      }

      const data = await res.json()
      setRunId(data.runId)
      
      // Start polling for results
      pollForResults(data.runId)
    } catch (err: any) {
      setError(err.message || 'Failed to start scraping')
      setScraping(false)
    }
  }

  const pollForResults = async (id: string) => {
    setPolling(true)
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max

    const poll = async () => {
      try {
        const res = await fetch(`/api/artists/scrape?runId=${id}`)
        const data = await res.json()

        if (data.status === 'SUCCEEDED') {
          setResults(data.results || [])
          setScraping(false)
          setPolling(false)
          return
        }

        if (data.status === 'FAILED' || data.status === 'ABORTED') {
          throw new Error('Scraping failed')
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          throw new Error('Scraping timed out')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch results')
        setScraping(false)
        setPolling(false)
      }
    }

    poll()
  }

  const handleImport = async () => {
    setImporting(true)
    setError('')

    try {
      const artists = results.map(r => ({
        name: r.name,
        spotify_url: r.spotify_url,
        spotify_monthly_listeners: r.spotify_monthly_listeners || 0,
        image_url: r.image_url,
        genres: r.genres || [],
        source: 'apify',
        source_batch: `apify-${new Date().toISOString().split('T')[0]}`,
      }))

      const res = await fetch('/api/artists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artists }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to import artists')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/artists')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to import artists')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spotify Scraper (Apify)</CardTitle>
        <CardDescription>
          Scrape artist data from Spotify using Apify actor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/15 text-green-500 px-4 py-3 rounded-md text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Artists imported successfully! Redirecting...
          </div>
        )}

        {!results.length && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actorId">Apify Actor ID</Label>
              <Input
                id="actorId"
                value={actorId}
                onChange={(e) => setActorId(e.target.value)}
                placeholder="epctex/spotify-scraper"
              />
              <p className="text-xs text-muted-foreground">
                Default: epctex/spotify-scraper
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Search Keywords</Label>
              <Input
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="hip-hop, rap, indie"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated keywords to search for
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="playlists">Playlist URLs</Label>
              <Textarea
                id="playlists"
                value={playlistUrls}
                onChange={(e) => setPlaylistUrls(e.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                One URL per line
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxResults">Max Results</Label>
              <Input
                id="maxResults"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                placeholder="50"
              />
            </div>

            <Button
              onClick={handleStartScrape}
              disabled={scraping || (!keywords && !playlistUrls)}
              className="w-full"
            >
              {scraping ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {polling ? 'Scraping in progress...' : 'Starting scrape...'}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Start Scraping
                </>
              )}
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">
                Found {results.length} Artists
              </h3>
              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Monthly Listeners</TableHead>
                      <TableHead>Genres</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((artist, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{artist.name}</TableCell>
                        <TableCell>
                          {artist.spotify_monthly_listeners?.toLocaleString() || '—'}
                        </TableCell>
                        <TableCell>
                          {artist.genres?.join(', ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResults([])
                  setRunId('')
                }}
              >
                Start New Scrape
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : `Import ${results.length} Artists`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
