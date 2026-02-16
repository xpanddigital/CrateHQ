'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface GrowthTrendProps {
  artistId: string
}

export function GrowthTrend({ artistId }: GrowthTrendProps) {
  const [loading, setLoading] = useState(true)
  const [growth, setGrowth] = useState<any>(null)

  const fetchGrowth = useCallback(async () => {
    try {
      const res = await fetch(`/api/artists/${artistId}/growth`)
      const data = await res.json()
      if (!data.error) {
        setGrowth(data)
      }
    } catch (error) {
      console.error('Error fetching growth:', error)
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    fetchGrowth()
  }, [fetchGrowth])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingSpinner size="sm" />
        </CardContent>
      </Card>
    )
  }

  if (!growth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Growth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No historical data available yet
          </p>
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = () => {
    switch (growth.trend_direction) {
      case 'growing':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />
    }
  }

  const getTrendColor = () => {
    switch (growth.trend_direction) {
      case 'growing':
        return 'text-green-500 border-green-500'
      case 'declining':
        return 'text-red-500 border-red-500'
      default:
        return 'text-yellow-500 border-yellow-500'
    }
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
  }

  const sparklineData = growth.sparkline?.filter((d: any) => d.listeners !== null) || []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Growth Trend</CardTitle>
          <Badge variant="outline" className={`gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="capitalize">{growth.trend_direction}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Month/Month</p>
            <p className={`text-lg font-bold ${growth.growth_mom > 0 ? 'text-green-500' : growth.growth_mom < 0 ? 'text-red-500' : ''}`}>
              {formatPercent(growth.growth_mom)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quarter/Quarter</p>
            <p className={`text-lg font-bold ${growth.growth_qoq > 0 ? 'text-green-500' : growth.growth_qoq < 0 ? 'text-red-500' : ''}`}>
              {formatPercent(growth.growth_qoq)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Year/Year</p>
            <p className={`text-lg font-bold ${growth.growth_yoy > 0 ? 'text-green-500' : growth.growth_yoy < 0 ? 'text-red-500' : ''}`}>
              {formatPercent(growth.growth_yoy)}
            </p>
          </div>
        </div>

        {sparklineData.length > 0 && (
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="listeners"
                  stroke={growth.trend_direction === 'growing' ? '#22c55e' : growth.trend_direction === 'declining' ? '#ef4444' : '#eab308'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
