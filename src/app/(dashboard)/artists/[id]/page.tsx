'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TagManager } from '@/components/artists/TagManager'
import { EnrichmentPanel } from '@/components/artists/EnrichmentPanel'
import { GrowthTrend } from '@/components/artists/GrowthTrend'
import { ArrowLeft, Mail, Instagram, Globe, Music, Sparkles, Edit, Save, X, DollarSign, Loader2, ShieldCheck, ShieldX, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Artist } from '@/types/database'
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils'
import { estimateCatalogValue } from '@/lib/valuation/estimator'

// Extended type for edit mode with temporary URL fields
interface ArtistEditData extends Partial<Artist> {
  instagram_url?: string
  youtube_url?: string
  facebook_url?: string
  twitter_url?: string
  tiktok_url?: string
}

export default function ArtistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<ArtistEditData>({})
  const [calculatingValue, setCalculatingValue] = useState(false)
  const [valuationResult, setValuationResult] = useState<any>(null)
  const [qualOverrideStatus, setQualOverrideStatus] = useState('')
  const [qualOverrideReason, setQualOverrideReason] = useState('')
  const [savingQual, setSavingQual] = useState(false)
  const { toast } = useToast()

  const handleQualificationOverride = async () => {
    if (!qualOverrideStatus || !artist) return
    setSavingQual(true)
    try {
      const res = await fetch(`/api/artists/${artist.id}/qualify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: qualOverrideStatus, reason: qualOverrideReason }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast({ title: 'Qualification updated', description: `Status set to ${qualOverrideStatus}` })
      fetchArtist()
      setQualOverrideStatus('')
      setQualOverrideReason('')
    } catch {
      toast({ title: 'Error', description: 'Failed to update qualification', variant: 'destructive' })
    } finally {
      setSavingQual(false)
    }
  }

  const fetchArtist = useCallback(async () => {
    try {
      const res = await fetch(`/api/artists/${params.id}`)
      const data = await res.json()
      if (data.artist) {
        setArtist(data.artist)
        setEditData(data.artist)
      }
    } catch (error) {
      console.error('Error fetching artist:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchArtist()
  }, [fetchArtist])

  const handleEdit = () => {
    setEditMode(true)
    setEditData(artist || {})
  }

  const handleCancel = () => {
    setEditMode(false)
    setEditData(artist || {})
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build social_links from editData
      const social_links: Record<string, string> = {}
      if (editData.social_links) {
        // Preserve existing social_links and update with any changes
        Object.assign(social_links, editData.social_links)
      }
      
      // Update social_links with individual URL fields if they exist in editData
      if (editData.instagram_url) social_links.instagram = editData.instagram_url
      if (editData.youtube_url) social_links.youtube = editData.youtube_url
      if (editData.facebook_url) social_links.facebook = editData.facebook_url
      if (editData.twitter_url) social_links.twitter = editData.twitter_url
      if (editData.tiktok_url) social_links.tiktok = editData.tiktok_url
      if (editData.spotify_url) social_links.spotify = editData.spotify_url
      if (editData.website) social_links.website = editData.website

      // Only send fields that can be updated
      const updatePayload = {
        name: editData.name,
        country: editData.country,
        spotify_monthly_listeners: editData.spotify_monthly_listeners,
        streams_last_month: editData.streams_last_month,
        track_count: editData.track_count,
        instagram_followers: editData.instagram_followers,
        biography: editData.biography,
        email: editData.email,
        instagram_handle: editData.instagram_handle,
        website: editData.website,
        spotify_url: editData.spotify_url,
        social_links,
      }

      const res = await fetch(`/api/artists/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update artist')
      }

      const data = await res.json()
      setArtist(data.artist)
      setEditMode(false)
      router.refresh()
    } catch (error: any) {
      console.error('Error updating artist:', error)
      alert(error.message || 'Failed to update artist')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateDeal = async () => {
    if (!artist) return

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_id: artist.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          alert('An active deal already exists for this artist')
        } else {
          throw new Error(data.error || 'Failed to create deal')
        }
        return
      }

      router.push(`/pipeline/${data.deal.id}`)
    } catch (error: any) {
      console.error('Error creating deal:', error)
      alert(error.message || 'Failed to create deal')
    }
  }

  const handleCalculateValue = async () => {
    if (!artist) return

    setCalculatingValue(true)
    try {
      // Use monthly listeners as proxy if streams_last_month is missing
      const streams = artist.streams_last_month || artist.spotify_monthly_listeners || 0

      if (streams === 0) {
        alert('Not enough streaming data to estimate catalog value. Add monthly listeners or streams data first.')
        return
      }

      const result = estimateCatalogValue({
        streams_last_month: streams,
        track_count: artist.track_count,
        spotify_monthly_listeners: artist.spotify_monthly_listeners,
        instagram_followers: artist.instagram_followers,
        growth_yoy: artist.growth_yoy,
      })

      setValuationResult(result)

      // Save to database
      const res = await fetch(`/api/artists/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimated_offer: result.point_estimate,
          estimated_offer_low: result.range_low,
          estimated_offer_high: result.range_high,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setArtist(data.artist)
      }
    } catch (error) {
      console.error('Error calculating value:', error)
    } finally {
      setCalculatingValue(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!artist) {
    return <div>Artist not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/artists">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <Button variant="outline" onClick={handleCalculateValue} disabled={calculatingValue}>
                {calculatingValue ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Get Catalog Value
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCreateDeal}>
                Create Deal
              </Button>
              <Button onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  {artist.image_url && (
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden">
                      <Image
                        src={artist.image_url}
                        alt={artist.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-2xl">{artist.name}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      {artist.genres.slice(0, 3).map((genre) => (
                        <Badge key={genre} variant="secondary">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editMode ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Listeners</p>
                      <p className="text-2xl font-bold">
                        {formatNumber(artist.spotify_monthly_listeners)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Offer</p>
                      <p className="text-2xl font-bold">
                        {artist.estimated_offer
                          ? (artist.estimated_offer >= 10000 
                              ? formatCurrency(artist.estimated_offer)
                              : 'Below threshold')
                          : '—'}
                      </p>
                      {artist.estimated_offer_low && artist.estimated_offer_high && artist.estimated_offer_low >= 10000 && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(artist.estimated_offer_low)} — {formatCurrency(artist.estimated_offer_high)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Growth (MoM)</p>
                      <p className="text-2xl font-bold">
                        {artist.growth_mom > 0 ? '+' : ''}
                        {(artist.growth_mom * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {artist.biography && (
                    <div>
                      <p className="text-sm font-medium mb-2">Biography</p>
                      <p className="text-sm text-muted-foreground">{artist.biography}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Artist Name</Label>
                      <Input
                        value={editData.name || ''}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input
                        value={editData.country || ''}
                        onChange={(e) => setEditData({ ...editData, country: e.target.value })}
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Listeners</Label>
                      <Input
                        type="number"
                        value={editData.spotify_monthly_listeners || 0}
                        onChange={(e) => setEditData({ ...editData, spotify_monthly_listeners: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Streams Last Month</Label>
                      <Input
                        type="number"
                        value={editData.streams_last_month || 0}
                        onChange={(e) => setEditData({ ...editData, streams_last_month: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Track Count</Label>
                      <Input
                        type="number"
                        value={editData.track_count || 0}
                        onChange={(e) => setEditData({ ...editData, track_count: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Instagram Followers</Label>
                      <Input
                        type="number"
                        value={editData.instagram_followers || 0}
                        onChange={(e) => setEditData({ ...editData, instagram_followers: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Biography</Label>
                    <Textarea
                      value={editData.biography || ''}
                      onChange={(e) => setEditData({ ...editData, biography: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {valuationResult && (
            <Card className={valuationResult.qualifies ? 'border-green-500/50' : 'border-yellow-500/50'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Catalog Valuation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimated Range</p>
                  <p className="text-2xl font-bold">{valuationResult.display_range}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <Badge
                      variant="outline"
                      className={
                        valuationResult.confidence === 'high'
                          ? 'text-green-500 border-green-500'
                          : valuationResult.confidence === 'medium'
                          ? 'text-yellow-500 border-yellow-500'
                          : 'text-orange-500 border-orange-500'
                      }
                    >
                      {valuationResult.confidence.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Qualifies</p>
                    <Badge
                      variant="outline"
                      className={
                        valuationResult.qualifies
                          ? 'text-green-500 border-green-500'
                          : 'text-red-500 border-red-500'
                      }
                    >
                      {valuationResult.qualifies ? 'YES' : 'NO'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {valuationResult.display_text}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!editMode ? (
                <>
                  {artist.email ? (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{artist.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {artist.email_source} • {(artist.email_confidence * 100).toFixed(0)}% confidence
                        </p>
                      </div>
                      {artist.is_contactable && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Contactable
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No email found</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  />
                </div>
              )}

              {!editMode ? (
                <>
                  {(artist.social_links?.instagram || artist.instagram_handle) && (
                    <div className="flex items-center gap-3">
                      <Instagram className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links?.instagram || `https://instagram.com/${artist.instagram_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        {artist.instagram_handle ? `@${artist.instagram_handle}` : 'Instagram'}
                      </a>
                    </div>
                  )}

                  {artist.social_links?.youtube && (
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        YouTube
                      </a>
                    </div>
                  )}

                  {artist.social_links?.facebook && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        Facebook
                      </a>
                    </div>
                  )}

                  {artist.social_links?.twitter && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        Twitter/X
                      </a>
                    </div>
                  )}

                  {artist.social_links?.tiktok && (
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        TikTok
                      </a>
                    </div>
                  )}

                  {(artist.social_links?.website || artist.website) && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links?.website || artist.website || ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        Website
                      </a>
                    </div>
                  )}

                  {(artist.social_links?.spotify || artist.spotify_url) && (
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.social_links?.spotify || artist.spotify_url || ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        Spotify Profile
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Social Media URLs</Label>
                    <p className="text-xs text-muted-foreground">
                      Used by enrichment pipeline to find contact emails
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Instagram URL</Label>
                      <Input
                        type="url"
                        value={editData.instagram_url || editData.social_links?.instagram || ''}
                        onChange={(e) => setEditData({ ...editData, instagram_url: e.target.value })}
                        placeholder="https://instagram.com/artist"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>YouTube URL</Label>
                      <Input
                        type="url"
                        value={editData.youtube_url || editData.social_links?.youtube || ''}
                        onChange={(e) => setEditData({ ...editData, youtube_url: e.target.value })}
                        placeholder="https://youtube.com/@artist"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Facebook URL</Label>
                      <Input
                        type="url"
                        value={editData.facebook_url || editData.social_links?.facebook || ''}
                        onChange={(e) => setEditData({ ...editData, facebook_url: e.target.value })}
                        placeholder="https://facebook.com/artist"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twitter/X URL</Label>
                      <Input
                        type="url"
                        value={editData.twitter_url || editData.social_links?.twitter || ''}
                        onChange={(e) => setEditData({ ...editData, twitter_url: e.target.value })}
                        placeholder="https://twitter.com/artist"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TikTok URL</Label>
                      <Input
                        type="url"
                        value={editData.tiktok_url || editData.social_links?.tiktok || ''}
                        onChange={(e) => setEditData({ ...editData, tiktok_url: e.target.value })}
                        placeholder="https://tiktok.com/@artist"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Spotify URL</Label>
                      <Input
                        type="url"
                        value={editData.spotify_url || editData.social_links?.spotify || ''}
                        onChange={(e) => setEditData({ ...editData, spotify_url: e.target.value })}
                        placeholder="https://open.spotify.com/artist/..."
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      type="url"
                      value={editData.website || editData.social_links?.website || ''}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <GrowthTrend artistId={artist.id} />

          <EnrichmentPanel
            artistId={artist.id}
            onEnrichmentComplete={fetchArtist}
          />

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <TagManager
                artistId={artist.id}
                currentTags={artist.tags || []}
                onTagsUpdated={fetchArtist}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {artist.qualification_status === 'qualified' && <ShieldCheck className="h-4 w-4 text-green-500" />}
                {artist.qualification_status === 'not_qualified' && <ShieldX className="h-4 w-4 text-red-500" />}
                {artist.qualification_status === 'review' && <ShieldAlert className="h-4 w-4 text-yellow-500" />}
                {(!artist.qualification_status || artist.qualification_status === 'pending') && <ShieldQuestion className="h-4 w-4 text-muted-foreground" />}
                Qualification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={
                  artist.qualification_status === 'qualified' ? 'default' :
                  artist.qualification_status === 'not_qualified' ? 'destructive' :
                  artist.qualification_status === 'review' ? 'secondary' : 'outline'
                }>
                  {(artist.qualification_status || 'pending').replace('_', ' ')}
                </Badge>
              </div>
              {artist.qualification_reason && (
                <div>
                  <p className="text-muted-foreground">Reason</p>
                  <p className="font-medium text-xs">{artist.qualification_reason}</p>
                </div>
              )}
              {artist.qualification_manual_override && (
                <Badge variant="outline" className="text-xs">Manual override</Badge>
              )}
              {artist.email_rejected && (
                <div className="bg-destructive/10 rounded p-2 text-xs">
                  <p className="font-medium text-destructive">Email rejected</p>
                  <p className="text-muted-foreground">{artist.email_rejection_reason}</p>
                </div>
              )}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Override</p>
                <Select value={qualOverrideStatus} onValueChange={setQualOverrideStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Change status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="not_qualified">Not Qualified</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                  </SelectContent>
                </Select>
                {qualOverrideStatus && (
                  <>
                    <Input
                      placeholder="Reason (optional)"
                      value={qualOverrideReason}
                      onChange={(e) => setQualOverrideReason(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={handleQualificationOverride}
                      disabled={savingQual}
                    >
                      {savingQual ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Save Override
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="font-medium capitalize">{artist.source}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Added</p>
                <p className="font-medium">{formatDate(artist.created_at)}</p>
              </div>
              {artist.last_enriched_at && (
                <div>
                  <p className="text-muted-foreground">Last Enriched</p>
                  <p className="font-medium">{formatDate(artist.last_enriched_at)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Enrichment Attempts</p>
                <p className="font-medium">{artist.enrichment_attempts}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
