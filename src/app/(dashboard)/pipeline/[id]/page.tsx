'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConversationThread } from '@/components/pipeline/ConversationThread'
import { ArrowLeft, Save } from 'lucide-react'
import { Deal, DEAL_STAGES } from '@/types/database'
import { formatCurrency, formatDate, getDaysSince } from '@/lib/utils'

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${params.id}`)
      const data = await res.json()
      if (data.deal) {
        setDeal(data.deal)
        setNotes(data.deal.notes || '')
      }
    } catch (error) {
      console.error('Error fetching deal:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchDeal()
  }, [fetchDeal])

  const handleStageChange = async (newStage: string) => {
    if (!deal) return

    try {
      const res = await fetch(`/api/deals/${deal.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) throw new Error('Failed to update stage')

      setDeal({ ...deal, stage: newStage as any, stage_changed_at: new Date().toISOString() })
    } catch (error) {
      console.error('Error updating stage:', error)
    }
  }

  const handleSaveNotes = async () => {
    if (!deal) return

    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })

      if (!res.ok) throw new Error('Failed to save notes')

      const data = await res.json()
      setDeal(data.deal)
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!deal) {
    return <div>Deal not found</div>
  }

  const currentStage = DEAL_STAGES.find(s => s.value === deal.stage)
  const daysInStage = getDaysSince(deal.stage_changed_at)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pipeline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pipeline
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">
                    {deal.artist?.name || 'Unknown Artist'}
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    {currentStage && (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: currentStage.color,
                          color: currentStage.color,
                        }}
                      >
                        {currentStage.label}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {daysInStage} days in stage
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Value</p>
                  <p className="text-xl font-bold">
                    {deal.estimated_deal_value
                      ? formatCurrency(deal.estimated_deal_value)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emails Sent</p>
                  <p className="text-xl font-bold">{deal.emails_sent}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Contact</p>
                  <p className="text-sm">
                    {deal.last_outreach_at
                      ? formatDate(deal.last_outreach_at)
                      : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ConversationThread
            dealId={deal.id}
            conversations={deal.conversations || []}
            onMessageAdded={fetchDeal}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={deal.stage} onValueChange={handleStageChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {deal.artist && (
            <Card>
              <CardHeader>
                <CardTitle>Artist Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {deal.artist.email && (
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{deal.artist.email}</p>
                  </div>
                )}
                {deal.artist.instagram_handle && (
                  <div>
                    <p className="text-muted-foreground">Instagram</p>
                    <p className="font-medium">@{deal.artist.instagram_handle}</p>
                  </div>
                )}
                {deal.artist.spotify_monthly_listeners > 0 && (
                  <div>
                    <p className="text-muted-foreground">Monthly Listeners</p>
                    <p className="font-medium">
                      {deal.artist.spotify_monthly_listeners.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={`/artists/${deal.artist.id}`}>
                      View Artist Profile
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Add notes about this deal..."
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Notes'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Scout</p>
                <p className="font-medium">{deal.scout?.full_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(deal.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDate(deal.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
