'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ArrowLeft, Briefcase, TrendingUp, DollarSign, Award, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DEAL_STAGES } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface ScoutDetail {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  stats: {
    total_deals: number
    active_deals: number
    won_deals: number
    lost_deals: number
    pipeline_value: number
    conversion_rate: string
  }
  deals_by_stage: Array<{ stage: string; count: number }>
  recent_deals: Array<{
    id: string
    stage: string
    created_at: string
    artist: { id: string; name: string }
  }>
}

export default function ScoutDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [scout, setScout] = useState<ScoutDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAccess = useCallback(async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Error checking access:', error)
    }
  }, [router])

  const fetchScoutDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scouts/${params.id}`)
      const data = await res.json()
      if (data.scout) {
        setScout(data.scout)
      }
    } catch (error) {
      console.error('Error fetching scout detail:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    checkAccess()
    fetchScoutDetail()
  }, [checkAccess, fetchScoutDetail])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!scout) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Scout not found</p>
      </div>
    )
  }

  // Prepare chart data
  const chartData = scout.deals_by_stage.map((item) => {
    const stageConfig = DEAL_STAGES.find((s) => s.value === item.stage)
    return {
      stage: stageConfig?.label || item.stage,
      count: item.count,
      color: stageConfig?.color || '#6B7280',
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{scout.full_name}</h1>
          <p className="text-muted-foreground">{scout.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={scout.role === 'admin' ? 'default' : 'outline'} className="capitalize">
            {scout.role}
          </Badge>
          <Badge variant={scout.is_active ? 'default' : 'outline'}>
            {scout.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scout.stats.total_deals}</div>
            <p className="text-xs text-muted-foreground">
              {scout.stats.active_deals} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Won</CardTitle>
            <Award className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{scout.stats.won_deals}</div>
            <p className="text-xs text-muted-foreground">
              {scout.stats.lost_deals} lost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scout.stats.conversion_rate}%</div>
            <p className="text-xs text-muted-foreground">
              Won / Total deals
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
              {formatCurrency(scout.stats.pipeline_value)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active deals only
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Distribution</CardTitle>
            <CardDescription>
              Deals by stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
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
                    {chartData.map((entry, index) => (
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

        {/* Recent Deals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Deals</CardTitle>
            <CardDescription>
              Latest deals created by this scout
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scout.recent_deals.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {scout.recent_deals.map((deal) => {
                  const stageConfig = DEAL_STAGES.find((s) => s.value === deal.stage)
                  return (
                    <div key={deal.id} className="flex items-center justify-between">
                      <div>
                        <Link
                          href={`/artists/${deal.artist.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {deal.artist.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(deal.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${stageConfig?.color}20`,
                          borderColor: stageConfig?.color,
                          color: stageConfig?.color,
                        }}
                      >
                        {stageConfig?.label || deal.stage}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">No recent deals</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Scout Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{scout.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <p className="text-sm capitalize">{scout.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-sm">{scout.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Joined</p>
              <p className="text-sm">{formatDate(scout.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
