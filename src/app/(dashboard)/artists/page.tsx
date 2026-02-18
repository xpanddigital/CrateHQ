'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { TagBadge } from '@/components/shared/TagBadge'
import { Plus, Search, Upload, Users, CheckCircle, XCircle, DollarSign, Download, Trash2, Briefcase, ShieldCheck, ShieldX, ShieldAlert, RefreshCw, HeartPulse, Ghost, MailX, Mail, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Artist } from '@/types/database'
import { formatNumber, formatDate, formatCurrency } from '@/lib/utils'
import { ArtistAddModal } from '@/components/artists/ArtistAddModal'
import { BulkTagModal } from '@/components/artists/BulkTagModal'
import { BulkEnrichModal } from '@/components/artists/BulkEnrichModal'

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkTagModal, setShowBulkTagModal] = useState(false)
  const [showBulkEnrichModal, setShowBulkEnrichModal] = useState(false)
  const [showEnrichUnenrichedModal, setShowEnrichUnenrichedModal] = useState(false)
  const [valuating, setValuating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [creatingDeals, setCreatingDeals] = useState(false)
  const [loadingUnenriched, setLoadingUnenriched] = useState(false)
  const [unenrichedCount, setUnenrichedCount] = useState(0)
  const [qualStats, setQualStats] = useState({ total: 0, qualified: 0, not_qualified: 0, review: 0, pending: 0 })
  const [runningQualification, setRunningQualification] = useState(false)
  const [showDataHealth, setShowDataHealth] = useState(false)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthRunning, setHealthRunning] = useState(false)
  const [healthData, setHealthData] = useState<{
    totalScanned: number
    ghosts: { count: number; details: Array<{ id: string; name: string; reason: string }> }
    invalidEmails: { count: number; details: Array<{ id: string; name: string; email: string; reason: string }> }
    junkEmails: { count: number; details: Array<{ id: string; name: string; email: string; reason: string }> }
    bioEmailCandidates: { count: number; details: Array<{ id: string; name: string; emails: string[] }> }
  } | null>(null)
  const [healthResult, setHealthResult] = useState<{
    ghostsDeleted: number
    invalidEmailsCleaned: number
    junkEmailsCleaned: number
    bioEmailsExtracted: number
  } | null>(null)
  const { toast } = useToast()

  const fetchArtists = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...(search && { search }),
      })

      const res = await fetch(`/api/artists?${params}`)
      const data = await res.json()

      if (data.artists) {
        setArtists(data.artists)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching artists:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

  // Fetch count of unenriched artists and qualification stats on mount
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [unenrichedRes, qualRes] = await Promise.all([
          fetch('/api/artists/unenriched-count'),
          fetch('/api/artists/qualify'),
        ])
        const unenrichedData = await unenrichedRes.json()
        setUnenrichedCount(unenrichedData.count || 0)

        const qualData = await qualRes.json()
        if (qualData.stats) setQualStats(qualData.stats)
      } catch (error) {
        console.error('Error fetching counts:', error)
      }
    }
    fetchCounts()
  }, [])

  const handleRerunQualification = async () => {
    setRunningQualification(true)
    try {
      const res = await fetch('/api/artists/qualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })
      const data = await res.json()
      if (data.summary) {
        setQualStats({
          total: data.summary.total,
          qualified: data.summary.qualified,
          not_qualified: data.summary.not_qualified,
          review: data.summary.review,
          pending: 0,
        })
        toast({
          title: 'Qualification complete',
          description: `${data.processed} artists evaluated. Qualified: ${data.summary.qualified}, Not qualified: ${data.summary.not_qualified}, Review: ${data.summary.review}${data.skipped_manual > 0 ? `, ${data.skipped_manual} manual overrides kept` : ''}`,
        })
      }
      // Refresh unenriched count since qualification may have changed who's eligible
      const countRes = await fetch('/api/artists/unenriched-count')
      const countData = await countRes.json()
      setUnenrichedCount(countData.count || 0)
      fetchArtists()
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to run qualification', variant: 'destructive' })
    } finally {
      setRunningQualification(false)
    }
  }

  const handleScanHealth = async () => {
    setHealthLoading(true)
    setHealthResult(null)
    try {
      const res = await fetch('/api/artists/cleanup')
      const data = await res.json()
      if (data.dryRun) {
        setHealthData(data)
        setShowDataHealth(true)
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to scan data health', variant: 'destructive' })
    } finally {
      setHealthLoading(false)
    }
  }

  const handleRunCleanup = async () => {
    if (!confirm('This will delete ghost rows, clear invalid emails, and extract bio emails. Continue?')) return
    setHealthRunning(true)
    try {
      const res = await fetch('/api/artists/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setHealthResult({
          ghostsDeleted: data.ghostsDeleted,
          invalidEmailsCleaned: data.invalidEmailsCleaned,
          junkEmailsCleaned: data.junkEmailsCleaned,
          bioEmailsExtracted: data.bioEmailsExtracted,
        })
        toast({
          title: 'Cleanup complete',
          description: `Deleted ${data.ghostsDeleted} ghosts, cleaned ${data.invalidEmailsCleaned + data.junkEmailsCleaned} emails, extracted ${data.bioEmailsExtracted} bio emails`,
        })
        fetchArtists()
        // Re-scan to update counts
        const scanRes = await fetch('/api/artists/cleanup')
        const scanData = await scanRes.json()
        if (scanData.dryRun) setHealthData(scanData)
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Cleanup failed', variant: 'destructive' })
    } finally {
      setHealthRunning(false)
    }
  }

  const handleEnrichAllUnenriched = async () => {
    setLoadingUnenriched(true)
    try {
      // Fetch all unenriched artist IDs
      const res = await fetch('/api/artists/unenriched-ids')
      const data = await res.json()
      
      if (data.ids && data.ids.length > 0) {
        setSelectedIds(new Set(data.ids))
        setShowEnrichUnenrichedModal(true)
      }
    } catch (error) {
      console.error('Error fetching unenriched artists:', error)
    } finally {
      setLoadingUnenriched(false)
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === artists.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(artists.map(a => a.id)))
    }
  }

  const [valuationProgress, setValuationProgress] = useState<{ done: number; total: number } | null>(null)

  const runPaginatedValuation = async (revalueAll: boolean) => {
    setValuating(true)
    setValuationProgress(null)
    let offset = 0
    let totalValuated = 0
    let totalSkipped = 0
    let totalCount = 0

    try {
      let hasMore = true
      while (hasMore) {
        const res = await fetch('/api/artists/bulk-valuate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true, revalueAll, offset, limit: 500 }),
        })

        if (!res.ok) throw new Error('Valuation failed')

        const data = await res.json()
        totalValuated += data.valuated
        totalSkipped += data.skipped
        totalCount = data.total
        hasMore = data.hasMore
        offset = data.nextOffset || 0

        setValuationProgress({ done: offset > totalCount ? totalCount : offset, total: totalCount })
      }

      toast({
        title: 'Valuation complete',
        description: `Valuated ${totalValuated.toLocaleString()} artists, skipped ${totalSkipped.toLocaleString()} (of ${totalCount.toLocaleString()} total)`,
      })
      fetchArtists()
    } catch (error) {
      console.error('Error valuating:', error)
      toast({ title: 'Error', description: 'Valuation failed', variant: 'destructive' })
    } finally {
      setValuating(false)
      setValuationProgress(null)
    }
  }

  const handleBulkValuate = async () => {
    setValuating(true)
    try {
      const res = await fetch('/api/artists/bulk-valuate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistIds: Array.from(selectedIds) }),
      })

      if (!res.ok) throw new Error('Valuation failed')

      const data = await res.json()
      toast({ title: 'Valuation complete', description: `Valuated ${data.valuated} artists, skipped ${data.skipped}` })
      setSelectedIds(new Set())
      fetchArtists()
    } catch (error) {
      console.error('Error valuating:', error)
      toast({ title: 'Error', description: 'Valuation failed', variant: 'destructive' })
    } finally {
      setValuating(false)
    }
  }

  const handleValuateAll = async () => {
    if (!confirm('Valuate all artists without estimates? This may take a moment.')) return
    await runPaginatedValuation(false)
  }

  const handleRevalueAll = async () => {
    if (!confirm('Re-run valuations for ALL artists? This will update all existing valuations.')) return
    await runPaginatedValuation(true)
  }

  const handleExport = (type: 'full' | 'valuation') => {
    const params = new URLSearchParams({
      type,
      ...(search && { search }),
    })
    window.open(`/api/artists/export?${params}`, '_blank')
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} artist(s)? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/artists/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistIds: Array.from(selectedIds) }),
      })

      if (!res.ok) throw new Error('Delete failed')

      const data = await res.json()
      alert(`Deleted ${data.deleted} artist(s)`)
      setSelectedIds(new Set())
      fetchArtists()
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Failed to delete artists')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkCreateDeals = async () => {
    if (!confirm(`Create deals for ${selectedIds.size} selected artist(s)?`)) {
      return
    }

    setCreatingDeals(true)
    try {
      const res = await fetch('/api/deals/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistIds: Array.from(selectedIds) }),
      })

      if (!res.ok) throw new Error('Failed to create deals')

      const data = await res.json()
      alert(`Created ${data.created} deal(s), skipped ${data.skipped} (already have active deals)`)
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Error creating deals:', error)
      alert('Failed to create deals')
    } finally {
      setCreatingDeals(false)
    }
  }

  if (loading && artists.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Artists</h1>
          <p className="text-muted-foreground">
            Manage your artist database and enrichment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('full')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('valuation')}>
            <Download className="h-4 w-4 mr-2" />
            Export Valuation Data
          </Button>
          <Button variant="outline" asChild>
            <Link href="/artists/import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Link>
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Artist
          </Button>
        </div>
      </div>

      <ArtistAddModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />

      <BulkTagModal
        open={showBulkTagModal}
        onOpenChange={setShowBulkTagModal}
        artistIds={Array.from(selectedIds)}
        onComplete={() => {
          setSelectedIds(new Set())
          fetchArtists()
        }}
      />

      <BulkEnrichModal
        open={showBulkEnrichModal}
        onOpenChange={setShowBulkEnrichModal}
        artistIds={Array.from(selectedIds)}
        onComplete={() => {
          setSelectedIds(new Set())
          fetchArtists()
        }}
      />

      <BulkEnrichModal
        open={showEnrichUnenrichedModal}
        onOpenChange={setShowEnrichUnenrichedModal}
        artistIds={Array.from(selectedIds)}
        onComplete={async () => {
          setSelectedIds(new Set())
          fetchArtists()
          // Refresh unenriched count
          try {
            const res = await fetch('/api/artists/unenriched-count')
            const data = await res.json()
            setUnenrichedCount(data.count || 0)
          } catch (error) {
            console.error('Error refreshing unenriched count:', error)
          }
        }}
      />

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artists..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkTagModal(true)}
              >
                Tag ({selectedIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkEnrichModal(true)}
              >
                Enrich ({selectedIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkValuate}
                disabled={valuating}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Valuate ({selectedIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkCreateDeals}
                disabled={creatingDeals}
              >
                <Briefcase className="h-4 w-4 mr-1" />
                Create Deals ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedIds.size})
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleValuateAll}
            disabled={valuating}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            {valuating && valuationProgress ? `${valuationProgress.done.toLocaleString()} / ${valuationProgress.total.toLocaleString()}` : 'Valuate All'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevalueAll}
            disabled={valuating}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            {valuating && valuationProgress ? `${valuationProgress.done.toLocaleString()} / ${valuationProgress.total.toLocaleString()}` : 'Revalue All'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRerunQualification}
            disabled={runningQualification}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${runningQualification ? 'animate-spin' : ''}`} />
            {runningQualification ? 'Qualifying...' : 'Run Qualification'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnrichAllUnenriched}
            disabled={loadingUnenriched || unenrichedCount === 0}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {loadingUnenriched ? 'Loading...' : `Enrich Qualified (${unenrichedCount})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanHealth}
            disabled={healthLoading}
          >
            <HeartPulse className={`h-4 w-4 mr-1 ${healthLoading ? 'animate-pulse' : ''}`} />
            {healthLoading ? 'Scanning...' : 'Data Health'}
          </Button>
        </div>
      </Card>

      {/* Data Health Panel */}
      {showDataHealth && healthData && (
        <Card className="p-4 border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Data Health Report</h3>
              <span className="text-xs text-muted-foreground">({healthData.totalScanned.toLocaleString()} artists scanned)</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRunCleanup}
                disabled={healthRunning || (healthData.ghosts.count === 0 && healthData.invalidEmails.count === 0 && healthData.junkEmails.count === 0 && healthData.bioEmailCandidates.count === 0)}
              >
                {healthRunning ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running...</> : 'Run Cleanup'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDataHealth(false)}>Close</Button>
            </div>
          </div>

          {healthResult && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-sm text-green-500">
              Cleanup complete: {healthResult.ghostsDeleted} ghosts deleted, {healthResult.invalidEmailsCleaned + healthResult.junkEmailsCleaned} emails cleaned, {healthResult.bioEmailsExtracted} bio emails extracted
            </div>
          )}

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
            <div className="flex items-center gap-2 p-2 rounded bg-background">
              <Ghost className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ghost Rows</p>
                <p className="text-lg font-bold text-red-500">{healthData.ghosts.count}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-background">
              <MailX className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Invalid Emails</p>
                <p className="text-lg font-bold text-orange-500">{healthData.invalidEmails.count}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-background">
              <XCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Junk Emails</p>
                <p className="text-lg font-bold text-yellow-500">{healthData.junkEmails.count}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-background">
              <Mail className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Bio Emails Available</p>
                <p className="text-lg font-bold text-green-500">{healthData.bioEmailCandidates.count}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 text-xs max-h-60 overflow-y-auto">
            {healthData.ghosts.count > 0 && (
              <div>
                <p className="font-medium text-red-400 mb-1">Ghost Rows (will be deleted):</p>
                <div className="space-y-0.5 pl-2">
                  {healthData.ghosts.details.slice(0, 20).map(g => (
                    <p key={g.id} className="text-muted-foreground">&ldquo;{g.name.slice(0, 60)}&rdquo; — {g.reason}</p>
                  ))}
                  {healthData.ghosts.details.length > 20 && (
                    <p className="text-muted-foreground">+ {healthData.ghosts.details.length - 20} more</p>
                  )}
                </div>
              </div>
            )}
            {healthData.invalidEmails.count > 0 && (
              <div>
                <p className="font-medium text-orange-400 mb-1">Invalid Emails (not email format):</p>
                <div className="space-y-0.5 pl-2">
                  {healthData.invalidEmails.details.slice(0, 10).map(e => (
                    <p key={e.id} className="text-muted-foreground">{e.name}: &ldquo;{e.email}&rdquo;</p>
                  ))}
                  {healthData.invalidEmails.details.length > 10 && (
                    <p className="text-muted-foreground">+ {healthData.invalidEmails.details.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
            {healthData.junkEmails.count > 0 && (
              <div>
                <p className="font-medium text-yellow-400 mb-1">Junk Emails (will be cleared):</p>
                <div className="space-y-0.5 pl-2">
                  {healthData.junkEmails.details.slice(0, 10).map(e => (
                    <p key={e.id} className="text-muted-foreground">{e.name}: {e.email} — {e.reason}</p>
                  ))}
                  {healthData.junkEmails.details.length > 10 && (
                    <p className="text-muted-foreground">+ {healthData.junkEmails.details.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
            {healthData.bioEmailCandidates.count > 0 && (
              <div>
                <p className="font-medium text-green-400 mb-1">Bio Emails (free enrichment):</p>
                <div className="space-y-0.5 pl-2">
                  {healthData.bioEmailCandidates.details.slice(0, 10).map(e => (
                    <p key={e.id} className="text-muted-foreground">{e.name}: {e.emails.join(', ')}</p>
                  ))}
                  {healthData.bioEmailCandidates.details.length > 10 && (
                    <p className="text-muted-foreground">+ {healthData.bioEmailCandidates.details.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Qualification Stats */}
      {qualStats.total > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Qualified</p>
                <p className="text-lg font-bold text-green-500">{qualStats.qualified}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Not Qualified</p>
                <p className="text-lg font-bold text-red-500">{qualStats.not_qualified}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Review Needed</p>
                <p className="text-lg font-bold text-yellow-500">{qualStats.review}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold">{qualStats.pending}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {artists.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No artists yet"
          description="Get started by adding artists manually or importing from CSV"
          action={{
            label: 'Add Artist',
            onClick: () => {},
          }}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === artists.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Streams</TableHead>
                <TableHead>Est. Value</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artists.map((artist) => (
                <TableRow key={artist.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(artist.id)}
                      onCheckedChange={() => toggleSelect(artist.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/artists/${artist.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {artist.name}
                      </Link>
                      {artist.qualification_status === 'not_qualified' && (
                        <span title="Not qualified"><ShieldX className="h-3 w-3 text-red-400 flex-shrink-0" /></span>
                      )}
                      {artist.qualification_status === 'review' && (
                        <span title="Review needed"><ShieldAlert className="h-3 w-3 text-yellow-400 flex-shrink-0" /></span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatNumber(artist.spotify_monthly_listeners)}
                  </TableCell>
                  <TableCell>
                    {artist.estimated_offer_low && artist.estimated_offer_high ? (
                      artist.estimated_offer_low >= 10000 ? (
                        <span className="text-sm font-medium">
                          {formatCurrency(artist.estimated_offer_low)} — {formatCurrency(artist.estimated_offer_high)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Below threshold</span>
                      )
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {artist.email ? (
                      <span className="text-sm">{artist.email}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {artist.is_contactable ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Contactable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" />
                          No Email
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {artist.tags?.slice(0, 2).map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                      {artist.tags && artist.tags.length > 2 && (
                        <Badge variant="outline">+{artist.tags.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(artist.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/artists/${artist.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
