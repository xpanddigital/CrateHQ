'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Mail, Send, Plus, CheckCircle, TrendingUp, Eye, Reply } from 'lucide-react'
import { Artist, Tag } from '@/types/database'
import { formatNumber, formatCurrency } from '@/lib/utils'

export default function OutreachPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [newCampaignName, setNewCampaignName] = useState('')
  const [loading, setLoading] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any[]>([])

  const fetchFilteredArtists = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        tags: selectedTagIds.join(','),
        is_contactable: 'true',
        limit: '100',
      })

      const res = await fetch(`/api/artists?${params}`)
      const data = await res.json()
      if (data.artists) {
        setArtists(data.artists)
      }
    } catch (error) {
      console.error('Error fetching artists:', error)
    }
  }, [selectedTagIds])

  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch tags
      const tagsRes = await fetch('/api/tags')
      const tagsData = await tagsRes.json()
      if (tagsData.tags) setTags(tagsData.tags)

      // Fetch campaigns
      const campaignsRes = await fetch('/api/outreach/campaigns')
      const campaignsData = await campaignsRes.json()
      if (campaignsData.campaigns) {
        setCampaigns(campaignsData.campaigns)
        
        // Fetch analytics for each campaign
        fetchAnalytics(campaignsData.campaigns)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    if (selectedTagIds.length > 0) {
      fetchFilteredArtists()
    } else {
      setArtists([])
    }
  }, [selectedTagIds, fetchFilteredArtists])

  const fetchAnalytics = async (campaignList: any[]) => {
    const analyticsData = []
    for (const campaign of campaignList.slice(0, 5)) {
      try {
        const res = await fetch(`/api/outreach/campaigns/${campaign.id}/analytics`)
        const data = await res.json()
        if (data.summary) {
          analyticsData.push({ campaign_id: campaign.id, ...data.summary })
        }
      } catch (error) {
        // Continue
      }
    }
    setAnalytics(analyticsData)
  }

  const handleCreateCampaign = async () => {
    if (!newCampaignName) return

    try {
      const res = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName }),
      })

      if (!res.ok) throw new Error('Failed to create campaign')

      const data = await res.json()
      setCampaigns([...campaigns, data.campaign])
      setSelectedCampaign(data.campaign.id)
      setNewCampaignName('')
    } catch (error) {
      console.error('Error creating campaign:', error)
    }
  }

  const handlePushLeads = async () => {
    if (!selectedCampaign || artists.length === 0) return

    setPushing(true)
    setResult(null)

    try {
      const res = await fetch('/api/outreach/push-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign,
          artistIds: artists.map(a => a.id),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to push leads')
      }

      const data = await res.json()
      setResult(data)
    } catch (error: any) {
      console.error('Error pushing leads:', error)
      setResult({ error: error.message })
    } finally {
      setPushing(false)
    }
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
      <div>
        <h1 className="text-3xl font-bold">Outreach</h1>
        <p className="text-muted-foreground">
          Push contactable artists to Instantly campaigns
        </p>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Configure Instantly.ai in Settings first
            </p>
            <Button variant="outline" asChild>
              <a href="/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Filter Artists</CardTitle>
              <CardDescription>
                Select tags to filter contactable artists
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTagIds.includes(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      style={
                        selectedTagIds.includes(tag.id)
                          ? { backgroundColor: tag.color, borderColor: tag.color }
                          : { borderColor: tag.color, color: tag.color }
                      }
                      onClick={() => {
                        setSelectedTagIds(prev =>
                          prev.includes(tag.id)
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                {selectedTagIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Select one or more tags to filter artists
                  </p>
                )}
              </div>

              {artists.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    {artists.length} contactable artists found
                  </p>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Streams</TableHead>
                          <TableHead>Est. Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {artists.slice(0, 10).map((artist) => (
                          <TableRow key={artist.id}>
                            <TableCell className="font-medium">{artist.name}</TableCell>
                            <TableCell className="text-sm">{artist.email}</TableCell>
                            <TableCell>{formatNumber(artist.streams_last_month)}</TableCell>
                            <TableCell>
                              {artist.estimated_offer_low && artist.estimated_offer_high
                                ? (artist.estimated_offer_low >= 10000
                                    ? `${formatCurrency(artist.estimated_offer_low)} - ${formatCurrency(artist.estimated_offer_high)}`
                                    : 'Below threshold')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {artists.length > 10 && (
                      <div className="p-2 text-center text-xs text-muted-foreground border-t">
                        +{artists.length - 10} more artists
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Campaign</CardTitle>
              <CardDescription>
                Choose an existing campaign or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign</Label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="New campaign name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                />
                <Button onClick={handleCreateCampaign} disabled={!newCampaignName}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>

              <Button
                onClick={handlePushLeads}
                disabled={!selectedCampaign || artists.length === 0 || pushing}
                className="w-full"
                size="lg"
              >
                {pushing ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Pushing Leads...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Push {artists.length} Leads to Instantly
                  </>
                )}
              </Button>

              {result && (
                <div className={`rounded-lg p-4 ${result.error ? 'bg-destructive/10 border border-destructive/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                  {result.error ? (
                    <p className="text-sm text-destructive">{result.error}</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <p className="font-semibold text-green-500">Leads Pushed Successfully!</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Added</p>
                          <p className="font-bold text-lg">{result.added}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Skipped</p>
                          <p className="font-bold text-lg">{result.skipped}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Deals Created</p>
                          <p className="font-bold text-lg">{result.deals_created}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {analytics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Campaign Analytics</CardTitle>
                <CardDescription>
                  Performance metrics for your Instantly campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.map((stat) => {
                    const campaign = campaigns.find(c => c.id === stat.campaign_id)
                    return (
                      <div key={stat.campaign_id} className="border rounded-lg p-4">
                        <p className="font-semibold mb-3">{campaign?.name || 'Campaign'}</p>
                        <div className="grid grid-cols-5 gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                              <Mail className="h-3 w-3" />
                              <span>Total</span>
                            </div>
                            <p className="font-bold">{stat.total_leads || 0}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                              <Send className="h-3 w-3" />
                              <span>Sent</span>
                            </div>
                            <p className="font-bold">{stat.emails_sent || 0}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                              <Eye className="h-3 w-3" />
                              <span>Opens</span>
                            </div>
                            <p className="font-bold">{stat.opens || 0}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                              <Reply className="h-3 w-3" />
                              <span>Replies</span>
                            </div>
                            <p className="font-bold text-green-500">{stat.replies || 0}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>Rate</span>
                            </div>
                            <p className="font-bold">
                              {stat.emails_sent > 0
                                ? `${((stat.replies / stat.emails_sent) * 100).toFixed(1)}%`
                                : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

