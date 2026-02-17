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
  created_at: string
  run_by: string
  scout?: { full_name: string }
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
    successRate: logs.length > 0 ? (logs.filter(l => l.is_contactable).length / logs.length * 100).toFixed(1) : 0,
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
      'Step 1: Method',
      'Step 1: Status',
      'Step 1: Duration (ms)',
      'Step 1: URL',
      'Step 1: Emails Found',
      'Step 2: Method',
      'Step 2: Status',
      'Step 2: Duration (ms)',
      'Step 2: URL',
      'Step 2: Emails Found',
      'Step 3: Method',
      'Step 3: Status',
      'Step 3: Duration (ms)',
      'Step 3: URL',
      'Step 3: Emails Found',
      'Step 4: Method',
      'Step 4: Status',
      'Step 4: Duration (ms)',
      'Step 4: URL',
      'Step 4: Emails Found',
      'Step 5: Method',
      'Step 5: Status',
      'Step 5: Duration (ms)',
      'Step 5: URL',
      'Step 5: Emails Found',
      'Step 6: Method',
      'Step 6: Status',
      'Step 6: Duration (ms)',
      'Step 6: URL',
      'Step 6: Emails Found',
      'Run By',
      'Created At',
    ]

    const rows = filteredLogs.map(log => {
      const row = [
        log.artist_name,
        log.artist_id,
        log.email_found || '',
        log.email_confidence,
        log.email_source,
        log.all_emails.map(e => `${e.email} (${e.source})`).join('; '),
        log.is_contactable ? 'Yes' : 'No',
        log.total_duration_ms,
      ]

      // Add step details (up to 6 steps)
      for (let i = 0; i < 6; i++) {
        const step = log.steps[i]
        if (step) {
          row.push(
            step.label || step.method,
            step.status,
            step.duration_ms || 0,
            step.url_fetched || '',
            step.emails_found?.join('; ') || ''
          )
        } else {
          row.push('', '', '', '', '')
        }
      }

      row.push(
        log.scout?.full_name || 'Unknown',
        log.created_at
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
