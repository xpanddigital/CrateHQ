'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle, XCircle, Sparkles, FileText } from 'lucide-react'
import { EnrichmentLogViewer } from './EnrichmentLogViewer'

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
  const [progress, setProgress] = useState({ current: 0, total: 0, emailsFound: 0 })
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')
  const [showDetailedLogs, setShowDetailedLogs] = useState(false)

  const handleEnrich = async () => {
    setEnriching(true)
    setError('')
    setProgress({ current: 0, total: artistIds.length, emailsFound: 0 })

    try {
      const res = await fetch('/api/artists/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistIds }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Bulk enrichment failed')
      }

      const data = await res.json()
      setResults(data)
      setProgress({ current: data.total, total: data.total, emailsFound: data.found_emails })

      // Wait a moment before closing
      setTimeout(() => {
        onOpenChange(false)
        onComplete()
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Enrichment failed')
    } finally {
      setEnriching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showDetailedLogs ? "max-w-5xl max-h-[90vh] overflow-y-auto" : ""}>
        <DialogHeader>
          <DialogTitle>Enrich {artistIds.length} Artists</DialogTitle>
          <DialogDescription>
            Run email enrichment pipeline on selected artists
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {!enriching && !results && (
            <div className="text-center py-4">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                This will run the enrichment pipeline on {artistIds.length} artists.
                <br />
                Each artist will be processed with a 1-second delay.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Estimated time: ~{Math.ceil(artistIds.length * 1 / 60)} minutes
              </p>
            </div>
          )}

          {enriching && (
            <div className="text-center py-4">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
              <p className="font-medium mb-2">Enriching artists...</p>
              <p className="text-sm text-muted-foreground mb-1">
                Processing {progress.current} of {progress.total}
              </p>
              <p className="text-sm font-semibold text-green-500">
                {progress.emailsFound} emails found so far
              </p>
              <div className="w-full bg-muted rounded-full h-2 mt-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {results && !showDetailedLogs && (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-semibold text-green-500">Enrichment Complete!</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Processed</p>
                    <p className="font-bold text-lg">{results.total}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Emails Found</p>
                    <p className="font-bold text-lg text-green-500">
                      {results.found_emails}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  <p className="text-xs text-muted-foreground mb-2">
                    Success Rate: {results.total > 0 ? ((results.found_emails / results.total) * 100).toFixed(1) : 0}%
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetailedLogs(true)}
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Detailed Logs
                  </Button>
                </div>
              </div>

              {results.errors && results.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <p className="font-semibold text-sm">
                      {results.errors.length} errors
                    </p>
                  </div>
                  <div className="space-y-1 text-xs">
                    {results.errors.slice(0, 3).map((err: any, i: number) => (
                      <p key={i} className="text-muted-foreground">
                        {err.artist_name}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {results && showDetailedLogs && results.detailed_logs && (
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
              <EnrichmentLogViewer logs={results.detailed_logs} />
            </div>
          )}
        </div>

        <DialogFooter>
          {!enriching && !results && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleEnrich}>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Enrichment
              </Button>
            </>
          )}
          {results && (
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
