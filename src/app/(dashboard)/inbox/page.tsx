'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Mail, CheckCircle, ExternalLink, Filter, Clock } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface InboxItem {
  id: string
  body: string
  ai_classification: string | null
  ai_confidence: number | null
  sent_at: string
  is_read: boolean
  requires_human_review: boolean
  deal: {
    id: string
    estimated_deal_value: number | null
    scout: {
      id: string
      full_name: string
      avatar_url: string | null
    }
  }
  artist: {
    id: string
    name: string
    image_url: string | null
    estimated_offer_low: number | null
    estimated_offer_high: number | null
  }
}

const CLASSIFICATION_COLORS = {
  interested: 'bg-green-100 text-green-800 border-green-200',
  question: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  objection: 'bg-orange-100 text-orange-800 border-orange-200',
  not_interested: 'bg-red-100 text-red-800 border-red-200',
  warm_no: 'bg-blue-100 text-blue-800 border-blue-200',
  unclear: 'bg-gray-100 text-gray-800 border-gray-200',
}

const CLASSIFICATION_ORDER = {
  interested: 1,
  question: 2,
  objection: 3,
  warm_no: 4,
  not_interested: 5,
  unclear: 6,
}

export default function InboxPage() {
  const router = useRouter()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClassification, setFilterClassification] = useState<string>('all')
  const [filterScout, setFilterScout] = useState<string>('all')

  const fetchInbox = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterClassification !== 'all') params.set('classification', filterClassification)
      if (filterScout !== 'all') params.set('scout_id', filterScout)

      const res = await fetch(`/api/inbox?${params}`)
      const data = await res.json()

      if (data.items) {
        // Sort by classification priority
        const sorted = data.items.sort((a: InboxItem, b: InboxItem) => {
          const aOrder = CLASSIFICATION_ORDER[a.ai_classification as keyof typeof CLASSIFICATION_ORDER] || 999
          const bOrder = CLASSIFICATION_ORDER[b.ai_classification as keyof typeof CLASSIFICATION_ORDER] || 999
          return aOrder - bOrder
        })
        setItems(sorted)
      }
    } catch (error) {
      console.error('Error fetching inbox:', error)
    } finally {
      setLoading(false)
    }
  }, [filterClassification, filterScout])

  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  const handleMarkRead = async (itemId: string) => {
    try {
      const res = await fetch(`/api/inbox/${itemId}/mark-read`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Failed to mark as read')

      // Remove from inbox
      setItems(items.filter(item => item.id !== itemId))
    } catch (error) {
      console.error('Error marking as read:', error)
      alert('Failed to mark as read')
    }
  }

  const getTimeSince = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return new Date(date).toLocaleDateString()
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
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
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">
            {items.length} {items.length === 1 ? 'message' : 'messages'} requiring attention
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterClassification} onValueChange={setFilterClassification}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Classifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="objection">Objection</SelectItem>
                <SelectItem value="warm_no">Warm No</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="unclear">Unclear</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterScout} onValueChange={setFilterScout}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Scouts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scouts</SelectItem>
                {/* TODO: Load scouts dynamically */}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inbox Items */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No messages requiring your attention right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/pipeline/${item.deal.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Artist Avatar */}
                  <div className="flex-shrink-0">
                    {item.artist.image_url ? (
                      <div className="relative h-12 w-12 rounded-full overflow-hidden">
                        <Image
                          src={item.artist.image_url}
                          alt={item.artist.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {getInitials(item.artist.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{item.artist.name}</h3>
                        {item.ai_classification && (
                          <Badge
                            variant="outline"
                            className={CLASSIFICATION_COLORS[item.ai_classification as keyof typeof CLASSIFICATION_COLORS] || CLASSIFICATION_COLORS.unclear}
                          >
                            {item.ai_classification}
                          </Badge>
                        )}
                        {item.requires_human_review && (
                          <Badge variant="destructive" className="text-xs">
                            Review Required
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                        <Clock className="h-4 w-4" />
                        {getTimeSince(item.sent_at)}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {item.body.substring(0, 150)}
                      {item.body.length > 150 && '...'}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={item.deal.scout.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(item.deal.scout.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            {item.deal.scout.full_name}
                          </span>
                        </div>
                        {item.artist.estimated_offer_low && item.artist.estimated_offer_high && (
                          <div className="text-muted-foreground">
                            {formatCurrency(item.artist.estimated_offer_low)} — {formatCurrency(item.artist.estimated_offer_high)}
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkRead(item.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Read
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={`/pipeline/${item.deal.id}`}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View Deal
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
