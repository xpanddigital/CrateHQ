'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  Users,
  Briefcase,
  DollarSign,
  Mail,
  CheckCircle,
  TrendingUp,
  UserPlus,
  MessageSquare,
  ArrowRight,
  Trophy,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DEAL_STAGES } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface DashboardData {
  stats: {
    total_artists: number
    contactable_artists: number
    active_deals: number
    total_pipeline_value: number
    unread_inbox: number
  }
  pipeline_funnel: Array<{ stage: string; count: number }>
  recent_activity: Array<{
    type: string
    timestamp: string
    artist_name: string
    artist_id?: string
    scout_name?: string
    stage?: string
    channel?: string
    subject?: string
    deal_id?: string
  }>
  scout_leaderboard: Array<{
    scout_id: string
    scout_name: string
    deals_created: number
    deals_won: number
    pipeline_value: number
  }> | null
  profile: {
    role: string
    full_name: string
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/analytics/dashboard')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
      </div>
    )
  }

  const isAdmin = data.profile.role === 'admin'

  // Prepare funnel data with colors
  const funnelData = data.pipeline_funnel.map((item) => {
    const stageConfig = DEAL_STAGES.find((s) => s.value === item.stage)
    return {
      stage: stageConfig?.label || item.stage,
      count: item.count,
      color: stageConfig?.color || '#6B7280',
    }
  })

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'artist_added':
        return UserPlus
      case 'deal_created':
        return Briefcase
      case 'message_received':
        return MessageSquare
      case 'message_sent':
        return Mail
      default:
        return CheckCircle
    }
  }

  const getActivityDescription = (activity: any) => {
    switch (activity.type) {
      case 'artist_added':
        return 'was added to the database'
      case 'deal_created':
        return `deal created (${DEAL_STAGES.find((s) => s.value === activity.stage)?.label || activity.stage})`
      case 'message_received':
        return `replied via ${activity.channel}`
      case 'message_sent':
        return `message sent via ${activity.channel}`
      default:
        return 'activity'
    }
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(timestamp)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {data.profile.full_name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Artists</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.total_artists.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              In your database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contactable</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.contactable_artists.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.total_artists > 0
                ? `${((data.stats.contactable_artists / data.stats.total_artists) * 100).toFixed(0)}% of total`
                : 'No artists yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.active_deals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              In pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.stats.total_pipeline_value)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total estimated value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Inbox</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.unread_inbox.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.unread_inbox > 0 ? 'Needs attention' : 'All caught up'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>
              Deals by stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="stage"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">No deals yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates across your pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent_activity.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {data.recent_activity.map((activity, index) => {
                  const Icon = getActivityIcon(activity.type)
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <Link
                            href={`/artists/${activity.artist_id}`}
                            className="font-medium hover:text-primary"
                          >
                            {activity.artist_name}
                          </Link>
                          {' — '}
                          <span className="text-muted-foreground">
                            {getActivityDescription(activity)}
                          </span>
                        </p>
                        {activity.scout_name && (
                          <p className="text-xs text-muted-foreground">
                            by {activity.scout_name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {getTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scout Leaderboard (Admin Only) */}
      {isAdmin && data.scout_leaderboard && data.scout_leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <CardTitle>Scout Leaderboard</CardTitle>
            </div>
            <CardDescription>
              Performance metrics for your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.scout_leaderboard.map((scout, index) => (
                <div
                  key={scout.scout_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                      <span className="text-sm font-bold text-primary">
                        #{index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{scout.scout_name}</p>
                      <div className="flex gap-4 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {scout.deals_created} deals created
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {scout.deals_won} won
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {formatCurrency(scout.pipeline_value)}
                    </p>
                    <p className="text-xs text-muted-foreground">Pipeline value</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Jump to key areas of your workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Link
              href="/artists"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group"
            >
              <div>
                <p className="font-medium">View Artists</p>
                <p className="text-sm text-muted-foreground">
                  Browse your database
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/pipeline"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group"
            >
              <div>
                <p className="font-medium">Pipeline</p>
                <p className="text-sm text-muted-foreground">
                  Track your deals
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/outreach"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group"
            >
              <div>
                <p className="font-medium">Outreach</p>
                <p className="text-sm text-muted-foreground">
                  Push leads to campaigns
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
