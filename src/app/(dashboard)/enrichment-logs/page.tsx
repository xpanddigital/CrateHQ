'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { EnrichmentLogViewer } from '@/components/artists/EnrichmentLogViewer'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { FileText, Search, Filter, Calendar, CheckCircle, XCircle, Download, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { BatchDashboard } from '@/components/enrichment/BatchDashboard'

interface EnrichmentLog {
  id: string
  artist_id: string
  artist_name: string
  email_found: string | null
  email_confidence: number
  email_source: string
  all_emails: Array<{ email: string; source: string; confidence: number }>
  steps: any[]
  total_duration_ms: number
  is_contactable: boolean
  error_details?: string
  created_at: string
  run_by: string
  scout?: { full_name: string }
  artist?: {
    spotify_url: string | null
    website: string | null
    instagram_handle: string | null
    social_links: Record<string, string> | null
    management_company: string | null
    booking_agency: string | null
  }
}

export default function EnrichmentLogsPage() {
  const [logs, setLogs] = useState<EnrichmentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')
  const { toast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/enrichment/logs')
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Error fetching enrichment logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = async () => {
    setClearing(true)
    try {
      const res = await fetch('/api/enrichment/logs', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to clear logs')
      }
      setLogs([])
      toast({ title: 'Logs cleared', description: 'All enrichment logs have been removed.' })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setClearing(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    // Filter by search
    if (search && !log.artist_name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }

    // Filter by status
    if (filter === 'success' && !log.is_contactable) return false
    if (filter === 'failed' && log.is_contactable) return false

    return true
  })

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.is_contactable).length,
    failed: logs.filter(l => !l.is_contactable).length,
    successRate: logs.length > 0 ? (logs.filter(l => l.is_contactable).length / logs.length * 100).toFixed(1) : '0',
  }

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No logs to export')
      return
    }

    // Build CSV content
    const headers = [
      'Artist Name',
      'Artist ID',
      'Email Found',
      'Email Confidence',
      'Email Source',
      'All Emails',
      'Is Contactable',
      'Total Duration (ms)',
      'Step 0: Method (YouTube Discovery)',
      'Step 0: Status',
      'Step 0: Duration (ms)',
      'Step 0: URL',
      'Step 0: Emails Found',
      'Step 0: Actor',
      'Step 0: Error',
      'Step 1: Method (YouTube Extract)',
      'Step 1: Status',
      'Step 1: Duration (ms)',
      'Step 1: URL',
      'Step 1: Emails Found',
      'Step 1: Actor',
      'Step 1: Error',
      'Step 2: Method (Instagram)',
      'Step 2: Status',
      'Step 2: Duration (ms)',
      'Step 2: URL',
      'Step 2: Emails Found',
      'Step 2: Actor',
      'Step 2: Error',
      'Step 3: Method (Link-in-Bio)',
      'Step 3: Status',
      'Step 3: Duration (ms)',
      'Step 3: URL',
      'Step 3: Emails Found',
      'Step 3: Actor',
      'Step 3: Error',
      'Step 4: Method (Website)',
      'Step 4: Status',
      'Step 4: Duration (ms)',
      'Step 4: URL',
      'Step 4: Emails Found',
      'Step 4: Actor',
      'Step 4: Error',
      'Step 5: Method (Facebook)',
      'Step 5: Status',
      'Step 5: Duration (ms)',
      'Step 5: URL',
      'Step 5: Emails Found',
      'Step 5: Actor',
      'Step 5: Error',
      'Step 6: Method (Remaining)',
      'Step 6: Status',
      'Step 6: Duration (ms)',
      'Step 6: URL',
      'Step 6: Emails Found',
      'Step 6: Actor',
      'Step 6: Error',
      'Step 7: Method (Perplexity YT Deep Dive)',
      'Step 7: Status',
      'Step 7: Duration (ms)',
      'Step 7: URL',
      'Step 7: Emails Found',
      'Step 7: Actor',
      'Step 7: Error',
      'Step 8: Method (Perplexity IG Deep Dive)',
      'Step 8: Status',
      'Step 8: Duration (ms)',
      'Step 8: URL',
      'Step 8: Emails Found',
      'Step 8: Actor',
      'Step 8: Error',
      'Step 9: Method (Perplexity Generic)',
      'Step 9: Status',
      'Step 9: Duration (ms)',
      'Step 9: URL',
      'Step 9: Emails Found',
      'Step 9: Actor',
      'Step 9: Error',
      'Error Details',
      'Run By',
      'Created At',
      'Spotify URL',
      'Instagram URL',
      'YouTube URL',
      'Website',
      'Management Company',
      'Booking Agency',
    ]

    const rows = filteredLogs.map(log => {
      const steps = log.steps || []
      const allEmailsList = log.all_emails || []
      const row: (string | number)[] = [
        log.artist_name,
        log.artist_id,
        log.email_found || '',
        log.email_confidence,
        log.email_source || '',
        allEmailsList.map(e => `${e.email} (${e.source})`).join('; '),
        log.is_contactable ? 'Yes' : 'No',
        log.total_duration_ms,
      ]

      // Add step details (up to 10 steps: Step 0 discovery + Steps 1-9) with actor and error info
      for (let i = 0; i < 10; i++) {
        const step = steps[i]
        if (step) {
          row.push(
            step.label || step.method,
            step.status,
            step.duration_ms || 0,
            step.url_fetched || '',
            step.emails_found?.join('; ') || '',
            step.apify_actor || '',
            step.error_details || step.error || ''
          )
        } else {
          row.push('', '', '', '', '', '', '')
        }
      }

      const sl = log.artist?.social_links || {}
      row.push(
        log.error_details || '',
        log.scout?.full_name || 'Unknown',
        log.created_at,
        log.artist?.spotify_url || sl.spotify || '',
        sl.instagram_url || sl.instagram || (log.artist?.instagram_handle ? `https://www.instagram.com/${log.artist.instagram_handle}/` : ''),
        sl.youtube || sl.youtube_url || '',
        log.artist?.website || sl.website || '',
        log.artist?.management_company || '',
        log.artist?.booking_agency || '',
      )

      return row
    })

    // Escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `enrichment-logs-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
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
          <h1 className="text-3xl font-bold">Enrichment Logs</h1>
          <p className="text-muted-foreground">
            View detailed results from email enrichment runs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV ({filteredLogs.length})
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={logs.length === 0 || clearing} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Logs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all enrichment logs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {logs.length} enrichment log{logs.length !== 1 ? 's' : ''}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={fetchLogs} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Server-Side Batch Enrichment */}
      <BatchDashboard />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Found</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.success}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Email</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by artist name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('success')}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Success
            </Button>
            <Button
              variant={filter === 'failed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('failed')}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Failed
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No enrichment logs yet"
          description="Run enrichment on artists to see detailed logs here"
          action={{
            label: 'Go to Artists',
            onClick: () => window.location.href = '/artists',
          }}
        />
      ) : (
        <EnrichmentLogViewer logs={filteredLogs} />
      )}

      {filteredLogs.length > 0 && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredLogs.length} of {logs.length} enrichment logs
          </p>
        </Card>
      )}
    </div>
  )
}
