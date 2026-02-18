'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Clock,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Zap,
  Timer,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Batch {
  id: string
  name: string
  total_artists: number
  completed: number
  failed: number
  skipped: number
  emails_found: number
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export function BatchDashboard() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [batchLimit, setBatchLimit] = useState('')
  const [showNewBatch, setShowNewBatch] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/enrichment/batch-status')
      const data = await res.json()
      if (data.batches) {
        setBatches(data.batches)
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBatches()

    // Poll every 10 seconds if there's an active batch
    pollRef.current = setInterval(fetchBatches, 10_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchBatches])

  const startBatch = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/enrichment/start-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName || undefined,
          limit: batchLimit ? parseInt(batchLimit) : undefined,
          filter: 'qualified',
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start batch')
      }

      toast({
        title: 'Batch started',
        description: `Queued ${data.totalQueued} artists. Estimated: ~${data.estimatedHours} hours.`,
      })

      setBatchName('')
      setBatchLimit('')
      setShowNewBatch(false)
      fetchBatches()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setStarting(false)
    }
  }

  const controlBatch = async (batchId: string, action: string) => {
    try {
      const res = await fetch('/api/enrichment/batch-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, action }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} batch`)
      }

      toast({ title: 'Success', description: `Batch ${action} successful` })
      fetchBatches()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const activeBatch = batches.find(b => ['processing', 'queued'].includes(b.status))

  const formatDuration = (startedAt: string | null) => {
    if (!startedAt) return '--'
    const ms = Date.now() - new Date(startedAt).getTime()
    const hours = Math.floor(ms / 3_600_000)
    const minutes = Math.floor((ms % 3_600_000) / 60_000)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const estimateRemaining = (batch: Batch) => {
    if (!batch.started_at || batch.completed <= 0) return 'Calculating...'
    const elapsed = Date.now() - new Date(batch.started_at).getTime()
    const perArtist = elapsed / batch.completed
    const remaining = batch.total_artists - batch.completed - batch.failed - batch.skipped
    const remainingMs = remaining * perArtist
    const hours = Math.floor(remainingMs / 3_600_000)
    const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
    if (hours > 0) return `~${hours}h ${minutes}m`
    return `~${minutes}m`
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      queued: { variant: 'secondary', label: 'Queued' },
      processing: { variant: 'default', label: 'Processing' },
      completed: { variant: 'outline', label: 'Completed' },
      paused: { variant: 'secondary', label: 'Paused' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    }
    const v = variants[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={v.variant}>{v.label}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Active Batch Card */}
      {activeBatch && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {activeBatch.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  {activeBatch.name || 'Active Batch'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {activeBatch.status === 'queued' ? 'Waiting for cron worker to pick up...' : 'Processing via server-side cron worker'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {activeBatch.status === 'processing' && (
                  <Button size="sm" variant="outline" onClick={() => controlBatch(activeBatch.id, 'pause')}>
                    <Pause className="h-4 w-4 mr-1" /> Pause
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Square className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this batch?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop processing and mark remaining artists as skipped. Already-processed artists will keep their results.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Running</AlertDialogCancel>
                      <AlertDialogAction onClick={() => controlBatch(activeBatch.id, 'cancel')}>
                        Cancel Batch
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {activeBatch.completed + activeBatch.failed + activeBatch.skipped} / {activeBatch.total_artists}
                </span>
                <span className="font-medium">
                  {activeBatch.total_artists > 0
                    ? ((activeBatch.completed + activeBatch.failed + activeBatch.skipped) / activeBatch.total_artists * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <Progress
                value={activeBatch.completed + activeBatch.failed + activeBatch.skipped}
                max={activeBatch.total_artists}
              />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{activeBatch.completed} completed</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-blue-500" />
                <span>{activeBatch.emails_found} emails found</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>{activeBatch.failed} failed</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span>Running: {formatDuration(activeBatch.started_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>ETA: {estimateRemaining(activeBatch)}</span>
              </div>
            </div>

            {/* Hit rate */}
            {activeBatch.completed > 0 && (
              <div className="text-sm text-muted-foreground">
                Hit rate: {((activeBatch.emails_found / activeBatch.completed) * 100).toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start New Batch / Batch Controls */}
      <div className="flex items-center gap-2">
        {!activeBatch && (
          <>
            {showNewBatch ? (
              <Card className="w-full p-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Batch Name (optional)</label>
                    <Input
                      placeholder="e.g. 5K artists Feb 2026"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-sm font-medium mb-1 block">Limit</label>
                    <Input
                      type="number"
                      placeholder="All"
                      value={batchLimit}
                      onChange={(e) => setBatchLimit(e.target.value)}
                    />
                  </div>
                  <Button onClick={startBatch} disabled={starting}>
                    {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                    Start Batch
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewBatch(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Only qualified artists without an email will be queued. The cron worker processes ~3 artists per minute.
                </p>
              </Card>
            ) : (
              <Button onClick={() => setShowNewBatch(true)}>
                <Zap className="h-4 w-4 mr-2" />
                Start Server-Side Batch Enrichment
              </Button>
            )}
          </>
        )}
      </div>

      {/* Paused batch resume */}
      {batches.filter(b => b.status === 'paused').map(batch => (
        <Card key={batch.id} className="border-yellow-500/50 bg-yellow-500/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{batch.name || 'Batch'}</span>
              <span className="text-sm text-muted-foreground ml-2">
                — Paused at {batch.completed}/{batch.total_artists}
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => controlBatch(batch.id, 'resume')}>
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
              <Button size="sm" variant="destructive" onClick={() => controlBatch(batch.id, 'cancel')}>
                <Square className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {/* Historical Batches */}
      {batches.filter(b => ['completed', 'cancelled'].includes(b.status)).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {batches
                .filter(b => ['completed', 'cancelled'].includes(b.status))
                .map(batch => {
                  const processed = batch.completed + batch.failed + batch.skipped
                  const hitRate = batch.completed > 0
                    ? ((batch.emails_found / batch.completed) * 100).toFixed(1)
                    : '0'

                  return (
                    <div key={batch.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        {statusBadge(batch.status)}
                        <div>
                          <span className="font-medium text-sm">{batch.name || 'Unnamed Batch'}</span>
                          <div className="text-xs text-muted-foreground">
                            {new Date(batch.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{processed}/{batch.total_artists} processed</span>
                        <span className="text-green-600">{batch.emails_found} emails</span>
                        <span className="text-muted-foreground">{hitRate}% hit rate</span>
                        {batch.failed > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-red-500">{batch.failed} failed</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => controlBatch(batch.id, 'retry_failed')}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
