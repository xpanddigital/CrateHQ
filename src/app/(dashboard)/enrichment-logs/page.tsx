'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { EnrichmentLogViewer } from '@/components/artists/EnrichmentLogViewer'
import { FileText, Search, Filter, Calendar, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

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
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')

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
        <Button onClick={fetchLogs} variant="outline">
          Refresh
        </Button>
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
