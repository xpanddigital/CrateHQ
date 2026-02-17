'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle, XCircle, Sparkles, FileText, Square } from 'lucide-react'
import { EnrichmentLogViewer } from './EnrichmentLogViewer'

interface ArtistResult {
  artist_id: string
  artist_name: string
  email_found: string | null
  email_confidence: number
  email_source: string
  all_emails: Array<{ email: string; source: string; confidence: number }>
  steps: any[]
  total_duration_ms: number
  is_contactable: boolean
  error?: string
  error_details?: string
}

interface BulkEnrichModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  artistIds: string[]
  onComplete: () => void
}

export function BulkEnrichModal({
  open,
  onOpenChange,
  artistIds,
  onComplete,
}: BulkEnrichModalProps) {
  const [enriching, setEnriching] = useState(false)
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    emailsFound: 0,
    currentArtist: '',
  })
  const [results, setResults] = useState<ArtistResult[]>([])
  const [errors, setErrors] = useState<Array<{ artist_id: string; artist_name: string; error: string }>>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [showDetailedLogs, setShowDetailedLogs] = useState(false)
  const stopRef = useRef(false)

  const handleEnrich = async () => {
    setEnriching(true)
    setError('')
    setDone(false)
    setResults([])
    setErrors([])
    stopRef.current = false
    setProgress({ current: 0, total: artistIds.length, emailsFound: 0, currentArtist: '' })

    const allResults: ArtistResult[] = []
    const allErrors: Array<{ artist_id: string; artist_name: string; error: string }> = []
    let emailsFound = 0

    for (let i = 0; i < artistIds.length; i++) {
      if (stopRef.current) {
        console.log(`[BulkEnrich] Stopped by user at ${i}/${artistIds.length}`)
        break
      }

      const artistId = artistIds[i]

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        currentArtist: `Artist ${i + 1} of ${artistIds.length}`,
      }))

      try {
        const res = await fetch(`/api/artists/${artistId}/enrich`, {
          method: 'POST',
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(data.error || `HTTP ${res.status}`)
        }

        const result: ArtistResult = await res.json()
        result.artist_id = artistId

        allResults.push(result)
        setResults([...allResults])

        if (result.email_found) {
          emailsFound++
          setProgress(prev => ({ ...prev, emailsFound }))
        }

        setProgress(prev => ({
          ...prev,
          currentArtist: result.artist_name || `Artist ${i + 1}`,
        }))
      } catch (err: any) {
        console.error(`[BulkEnrich] Failed for ${artistId}:`, err.message)
        allErrors.push({
          artist_id: artistId,
          artist_name: `Artist ${i + 1}`,
          error: err.message,
        })
        setErrors([...allErrors])
      }

      // 3-second delay between artists to avoid Apify rate limits
      if (i < artistIds.length - 1 && !stopRef.current) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    setEnriching(false)
    setDone(true)
    onComplete()
  }

  const handleStop = () => {
    stopRef.current = true
  }

  const handleClose = () => {
    if (enriching) {
      stopRef.current = true
    }
    setDone(false)
    setResults([])
    setErrors([])
    setShowDetailedLogs(false)
    onOpenChange(false)
  }

  const totalProcessed = results.length + errors.length
  const successRate = totalProcessed > 0
    ? ((progress.emailsFound / totalProcessed) * 100).toFixed(1)
    : '0'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={showDetailedLogs ? 'max-w-5xl max-h-[90vh] overflow-y-auto' : ''}>
        <DialogHeader>
          <DialogTitle>Enrich {artistIds.length} Artists</DialogTitle>
          <DialogDescription>
            Each artist is enriched individually (~30-60s each)
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Pre-start state */}
          {!enriching && !done && (
            <div className="text-center py-4">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                This will run the enrichment pipeline on {artistIds.length} artist{artistIds.length !== 1 ? 's' : ''}.
                <br />
                Each artist is processed individually with a 3-second delay between requests.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Estimated time: ~{Math.ceil(artistIds.length * 45 / 60)} – {Math.ceil(artistIds.length * 65 / 60)} minutes
              </p>
            </div>
          )}

          {/* In-progress state */}
          {enriching && (
            <div className="text-center py-4">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
              <p className="font-medium mb-2">
                Enriching artist {progress.current} of {progress.total}...
              </p>
              {progress.currentArtist && (
                <p className="text-sm text-muted-foreground mb-1">
                  {progress.currentArtist}
                </p>
              )}
              <p className="text-sm font-semibold text-green-500">
                {progress.emailsFound} email{progress.emailsFound !== 1 ? 's' : ''} found so far
              </p>
              {errors.length > 0 && (
                <p className="text-xs text-destructive mt-1">
                  {errors.length} error{errors.length !== 1 ? 's' : ''}
                </p>
              )}
              <div className="w-full bg-muted rounded-full h-2 mt-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {totalProcessed} processed • {progress.total - totalProcessed} remaining
              </p>
            </div>
          )}

          {/* Completed state */}
          {done && !showDetailedLogs && (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-semibold text-green-500">
                    {stopRef.current ? 'Enrichment Stopped' : 'Enrichment Complete!'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Processed</p>
                    <p className="font-bold text-lg">{totalProcessed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Emails Found</p>
                    <p className="font-bold text-lg text-green-500">
                      {progress.emailsFound}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-bold text-lg">{successRate}%</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetailedLogs(true)}
                    className="w-full"
                    disabled={results.length === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Detailed Logs ({results.length})
                  </Button>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <p className="font-semibold text-sm">
                      {errors.length} error{errors.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                    {errors.map((err, i) => (
                      <p key={i} className="text-muted-foreground">
                        {err.artist_name}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed logs view */}
          {done && showDetailedLogs && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Detailed Enrichment Logs</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailedLogs(false)}
                >
                  Back to Summary
                </Button>
              </div>
              <EnrichmentLogViewer logs={results} />
            </div>
          )}
        </div>

        <DialogFooter>
          {!enriching && !done && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleEnrich}>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Enrichment
              </Button>
            </>
          )}
          {enriching && (
            <Button variant="destructive" onClick={handleStop}>
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
          {done && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
