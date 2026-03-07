'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Activity, Pause, Play, Eye, X, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff,
} from 'lucide-react'

interface Agent {
  id: string
  ig_username: string
  vm_identifier: string | null
  timezone: string
  active_start_hour: number
  active_end_hour: number
  is_active: boolean
  status: string
  last_heartbeat: string | null
  messages_today: { found: number; sent: number }
  assigned_scout_id: string | null
  daily_cold_dm_limit: number
}

interface HeartbeatLog {
  id: string
  ig_account_id: string
  status: string
  messages_found: number
  messages_sent: number
  error_detail: string | null
  created_at: string
}

const ERROR_STATUSES = ['error', 'session_expired', 'challenge_required', 'rate_limited']

function getHealthStatus(agent: Agent): { label: string; color: string; icon: typeof CheckCircle } {
  if (!agent.is_active) {
    return { label: 'Paused', color: 'text-gray-400 border-gray-400/30 bg-gray-400/10', icon: Pause }
  }

  if (ERROR_STATUSES.includes(agent.status)) {
    return { label: agent.status.replace(/_/g, ' '), color: 'text-red-500 border-red-500/30 bg-red-500/10', icon: AlertTriangle }
  }

  if (!agent.last_heartbeat) {
    return { label: 'Offline', color: 'text-red-500 border-red-500/30 bg-red-500/10', icon: WifiOff }
  }

  const now = new Date()
  const hb = new Date(agent.last_heartbeat)
  const diffMin = (now.getTime() - hb.getTime()) / 60000

  // Check if within active hours
  const agentNow = new Date(now.toLocaleString('en-US', { timeZone: agent.timezone || 'America/Los_Angeles' }))
  const currentHour = agentNow.getHours()
  const inActiveWindow = currentHour >= agent.active_start_hour && currentHour < agent.active_end_hour

  if (diffMin < 15 && inActiveWindow) {
    return { label: 'Healthy', color: 'text-green-500 border-green-500/30 bg-green-500/10', icon: CheckCircle }
  }
  if (diffMin < 15 && !inActiveWindow) {
    return { label: 'Sleeping', color: 'text-blue-400 border-blue-400/30 bg-blue-400/10', icon: Clock }
  }
  if (diffMin < 30) {
    return { label: 'Stale', color: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10', icon: AlertTriangle }
  }
  return { label: 'Offline', color: 'text-red-500 border-red-500/30 bg-red-500/10', icon: WifiOff }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function formatActiveWindow(start: number, end: number, tz: string): string {
  const fmtHour = (h: number) => {
    if (h === 0) return '12am'
    if (h === 12) return '12pm'
    return h > 12 ? `${h - 12}pm` : `${h}am`
  }
  const tzAbbr = tz.includes('Los_Angeles') ? 'PST' :
    tz.includes('New_York') ? 'EST' :
    tz.includes('Chicago') ? 'CST' :
    tz.includes('Denver') ? 'MST' :
    tz.includes('London') ? 'GMT' : tz.split('/').pop() || tz
  return `${fmtHour(start)}–${fmtHour(end)} ${tzAbbr}`
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [scouts, setScouts] = useState<{ id: string, full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [logsModal, setLogsModal] = useState<{ accountId: string; username: string } | null>(null)
  const [logs, setLogs] = useState<HeartbeatLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [panicking, setPanicking] = useState(false)
  const { toast } = useToast()

  const fetchScouts = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'scout')
    if (data) setScouts(data)
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents')
      const data = await res.json()
      if (data.agents) setAgents(data.agents)
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScouts()
    fetchAgents()
    const interval = setInterval(fetchAgents, 30000)
    return () => clearInterval(interval)
  }, [fetchAgents, fetchScouts])

  const handleUpdateAgent = async (accountId: string, updates: any) => {
    try {
      const res = await fetch(`/api/admin/agents/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update agent configuration')
      
      setAgents(prev => prev.map(a => a.id === accountId ? { ...a, ...updates } : a))
      
      if ('assigned_scout_id' in updates) {
        const scout = scouts.find(s => s.id === updates.assigned_scout_id)
        toast({ title: 'Agent Updated', description: `Assigned to ${scout ? scout.full_name : 'Nobody'}` })
      }
      if ('daily_cold_dm_limit' in updates) {
        toast({ title: 'Agent Updated', description: `Daily limit updated to ${updates.daily_cold_dm_limit}` })
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleToggle = async (accountId: string, currentActive: boolean) => {
    setToggling(accountId)
    try {
      const res = await fetch(`/api/admin/agents/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      
      if (!res.ok) throw new Error('Failed to toggle agent status')
        
      setAgents(prev => prev.map(a =>
        a.id === accountId ? { ...a, is_active: !currentActive } : a
      ))

      const agentUsername = agents.find(a => a.id === accountId)?.ig_username
      if (!currentActive) {
        toast({ title: 'Account resumed', description: `@${agentUsername} is now active.` })
      } else {
        toast({ title: 'Emergency Kill Switch', description: `Account @${agentUsername} paused. The DM agent will no longer receive outbound messages.`, variant: 'destructive' })
      }
    } catch (error: any) {
      console.error('Toggle failed:', error)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  const handleGlobalPanic = async () => {
    if (!confirm('🚨 GLOBAL PANIC: Are you sure? This will instantly cut off ALL outbound DMs across the entire fleet. Every account will be paused.')) {
      return
    }

    setPanicking(true)
    try {
      const res = await fetch('/api/admin/agents/panic', {
        method: 'POST',
      })
      
      if (!res.ok) throw new Error('Failed to execute global panic')
      
      // Update local state so all UI switches flip off instantly
      setAgents(prev => prev.map(a => ({ ...a, is_active: false })))
      
      toast({ 
        title: '🚨 GLOBAL PANIC ACTIVATED', 
        description: 'All Instagram accounts have been successfully paused. No new outbound DMs will be sent.',
        variant: 'destructive',
      })
    } catch (error: any) {
      console.error('Global panic failed:', error)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setPanicking(false)
    }
  }

  const openLogs = async (accountId: string, username: string) => {
    setLogsModal({ accountId, username })
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/admin/agents/logs?account_id=${accountId}`)
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  // Summary counts
  const summary = agents.reduce(
    (acc, agent) => {
      const health = getHealthStatus(agent)
      if (health.label === 'Healthy') acc.healthy++
      else if (health.label === 'Stale') acc.stale++
      else if (health.label === 'Sleeping') acc.sleeping++
      else if (health.label === 'Paused') acc.paused++
      else acc.offline++
      return acc
    },
    { healthy: 0, stale: 0, offline: 0, sleeping: 0, paused: 0 }
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">DM Agents</h1>
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleGlobalPanic} 
            disabled={loading || panicking}
          >
            <AlertTriangle className={`h-4 w-4 mr-2 ${panicking ? 'animate-pulse' : ''}`} />
            GLOBAL PANIC: PAUSE ALL ACCOUNTS
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAgents} disabled={loading}>
            <Activity className={`h-4 w-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="font-medium">{summary.healthy}</span>
            <span className="text-muted-foreground">healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span className="font-medium">{summary.stale}</span>
            <span className="text-muted-foreground">stale</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="font-medium">{summary.offline}</span>
            <span className="text-muted-foreground">offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
            <span className="font-medium">{summary.sleeping}</span>
            <span className="text-muted-foreground">sleeping</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
            <span className="font-medium">{summary.paused}</span>
            <span className="text-muted-foreground">paused</span>
          </div>
        </div>
      </Card>

      {/* Agents Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Heartbeat</TableHead>
              <TableHead>Messages Today</TableHead>
              <TableHead>Scout Assignment</TableHead>
              <TableHead>Daily Limit</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Active Window</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading agents...
                </TableCell>
              </TableRow>
            ) : agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <Wifi className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  No agents configured
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => {
                const health = getHealthStatus(agent)
                const HealthIcon = health.icon
                return (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">@{agent.ig_username}</span>
                        <div className="text-xs text-muted-foreground">{agent.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${health.color}`}>
                        <HealthIcon className="h-3 w-3" />
                        {health.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {timeAgo(agent.last_heartbeat)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{agent.messages_today.found}</span>
                        <span className="text-muted-foreground"> found</span>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <span className="font-medium">{agent.messages_today.sent}</span>
                        <span className="text-muted-foreground"> sent</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={agent.assigned_scout_id || 'unassigned'} 
                        onValueChange={(val) => handleUpdateAgent(agent.id, { assigned_scout_id: val === 'unassigned' ? null : val })}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {scouts.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        className="w-20 h-8 text-xs" 
                        min={0} 
                        max={40} 
                        value={agent.daily_cold_dm_limit ?? 3}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, daily_cold_dm_limit: isNaN(val) ? 0 : val } : a))
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value)
                          handleUpdateAgent(agent.id, { daily_cold_dm_limit: isNaN(val) ? 0 : val })
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {agent.timezone.split('/').pop()?.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatActiveWindow(agent.active_start_hour, agent.active_end_hour, agent.timezone)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-2 mr-2">
                          <span className="text-xs text-muted-foreground uppercase font-semibold">Kill Switch</span>
                          <Switch 
                            checked={agent.is_active}
                            onCheckedChange={() => handleToggle(agent.id, agent.is_active)}
                            disabled={toggling === agent.id}
                            aria-label="Toggle active status"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openLogs(agent.id, agent.ig_username)}
                          title="View logs"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Logs Modal */}
      {logsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                Heartbeat Logs — @{logsModal.username}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setLogsModal(null); setLogs([]) }}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No heartbeat logs found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Found</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              log.status === 'healthy' ? 'text-green-500 border-green-500/30' :
                              ERROR_STATUSES.includes(log.status) ? 'text-red-500 border-red-500/30' :
                              'text-yellow-500 border-yellow-500/30'
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.messages_found}</TableCell>
                        <TableCell className="text-sm">{log.messages_sent}</TableCell>
                        <TableCell className="text-xs text-red-400 max-w-[200px] truncate" title={log.error_detail || ''}>
                          {log.error_detail || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
