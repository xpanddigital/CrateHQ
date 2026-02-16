'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ArrowLeft, Mail, Music, DollarSign, Calendar, User } from 'lucide-react'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

interface Deal {
  id: string
  stage: string
  estimated_deal_value: number | null
  actual_deal_value: number | null
  commission_amount: number | null
  notes: string | null
  stage_changed_at: string
  created_at: string
  artist: {
    id: string
    name: string
    image_url: string | null
    spotify_url: string | null
    spotify_monthly_listeners: number
    streams_last_month: number
    estimated_offer_low: number | null
    estimated_offer_high: number | null
    email: string | null
    instagram_handle: string | null
  }
  scout: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
  }
}

const STAGES = [
  { value: 'new', label: 'New' },
  { value: 'enriched', label: 'Enriched' },
  { value: 'outreach_queued', label: 'Outreach Queued' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'call_scheduled', label: 'Call Scheduled' },
  { value: 'call_completed', label: 'Call Completed' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'handed_off', label: 'Handed Off' },
  { value: 'in_negotiation', label: 'In Negotiation' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
  { value: 'nurture', label: 'Nurture' },
]

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [actualValue, setActualValue] = useState('')

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${params.id}`)
      const data = await res.json()
      if (data.deal) {
        setDeal(data.deal)
        setNotes(data.deal.notes || '')
        setActualValue(data.deal.actual_deal_value?.toString() || '')
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

      fetchDeal()
    } catch (error) {
      console.error('Error updating stage:', error)
      alert('Failed to update stage')
    }
  }

  const handleSave = async () => {
    if (!deal) return

    setSaving(true)
    try {
      const updates: any = { notes }
      
      if (actualValue) {
        updates.actual_deal_value = parseInt(actualValue)
      }

      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error('Failed to save')

      alert('Deal updated successfully')
      fetchDeal()
    } catch (error) {
      console.error('Error saving deal:', error)
      alert('Failed to save deal')
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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Deal not found</h2>
          <Button onClick={() => router.push('/pipeline')}>Back to Pipeline</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/pipeline')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{deal.artist.name}</h1>
            <p className="text-muted-foreground">Deal Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/artists/${deal.artist.id}`}>
              <Music className="h-4 w-4 mr-2" />
              View Artist
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Stage</Label>
                <Select value={deal.stage} onValueChange={handleStageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Actual Deal Value</Label>
                <Input
                  type="number"
                  placeholder="Enter actual deal value"
                  value={actualValue}
                  onChange={(e) => setActualValue(e.target.value)}
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add notes about this deal..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artist Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {deal.artist.image_url && (
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden">
                    <Image
                      src={deal.artist.image_url}
                      alt={deal.artist.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{deal.artist.name}</h3>
                  {deal.artist.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {deal.artist.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Listeners</p>
                  <p className="text-lg font-semibold">
                    {formatNumber(deal.artist.spotify_monthly_listeners)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Streams/Month</p>
                  <p className="text-lg font-semibold">
                    {formatNumber(deal.artist.streams_last_month)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Valuation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deal.artist.estimated_offer_low && deal.artist.estimated_offer_high ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Range</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(deal.artist.estimated_offer_low)} —{' '}
                      {formatCurrency(deal.artist.estimated_offer_high)}
                    </p>
                  </div>
                  {deal.actual_deal_value && (
                    <div>
                      <p className="text-sm text-muted-foreground">Actual Value</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(deal.actual_deal_value)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No valuation available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Scout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="font-medium">{deal.scout.full_name}</p>
                <p className="text-sm text-muted-foreground">{deal.scout.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(deal.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stage Changed</p>
                <p className="font-medium">{formatDate(deal.stage_changed_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
