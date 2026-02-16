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
import { ArrowLeft, Mail, Instagram, Globe, Music, Sparkles, Edit, Save, X } from 'lucide-react'
import { Artist } from '@/types/database'
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils'

export default function ArtistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<Partial<Artist>>({})

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
      const res = await fetch(`/api/artists/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (!res.ok) throw new Error('Failed to update artist')

      const data = await res.json()
      setArtist(data.artist)
      setEditMode(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating artist:', error)
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
          notes: `Deal created for ${artist.name}`,
        }),
      })

      if (!res.ok) throw new Error('Failed to create deal')

      const data = await res.json()
      router.push(`/pipeline/${data.deal.id}`)
    } catch (error) {
      console.error('Error creating deal:', error)
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
                          ? formatCurrency(artist.estimated_offer)
                          : '—'}
                      </p>
                      {artist.estimated_offer_low && artist.estimated_offer_high && (
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
                  {artist.instagram_handle && (
                    <div className="flex items-center gap-3">
                      <Instagram className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`https://instagram.com/${artist.instagram_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        @{artist.instagram_handle}
                      </a>
                    </div>
                  )}

                  {artist.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-primary"
                      >
                        {artist.website}
                      </a>
                    </div>
                  )}

                  {artist.spotify_url && (
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={artist.spotify_url}
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
                    <Label>Instagram Handle</Label>
                    <Input
                      value={editData.instagram_handle || ''}
                      onChange={(e) => setEditData({ ...editData, instagram_handle: e.target.value })}
                      placeholder="champagnepapi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      type="url"
                      value={editData.website || ''}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Spotify URL</Label>
                    <Input
                      type="url"
                      value={editData.spotify_url || ''}
                      onChange={(e) => setEditData({ ...editData, spotify_url: e.target.value })}
                      placeholder="https://open.spotify.com/artist/..."
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
