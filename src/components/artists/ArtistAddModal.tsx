'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ArtistAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArtistAddModal({ open, onOpenChange }: ArtistAddModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    instagram_url: '',
    website: '',
    spotify_url: '',
    spotify_monthly_listeners: '',
    streams_last_month: '',
    track_count: '',
    genres: '',
    country: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Parse genres from comma-separated string
      const genresArray = formData.genres
        .split(',')
        .map(g => g.trim())
        .filter(Boolean)

      // Extract Instagram handle from URL
      let instagram_handle = null
      if (formData.instagram_url) {
        const instagramMatch = formData.instagram_url.match(/instagram\.com\/([^/?]+)/)
        if (instagramMatch) {
          instagram_handle = instagramMatch[1]
        }
      }

      // Build social_links object
      const social_links: Record<string, string> = {}
      if (formData.instagram_url) social_links.instagram = formData.instagram_url
      if (formData.spotify_url) social_links.spotify = formData.spotify_url
      if (formData.website) social_links.website = formData.website

      const payload = {
        name: formData.name,
        email: formData.email || null,
        instagram_handle,
        website: formData.website || null,
        spotify_url: formData.spotify_url || null,
        social_links,
        spotify_monthly_listeners: formData.spotify_monthly_listeners
          ? parseInt(formData.spotify_monthly_listeners)
          : 0,
        streams_last_month: formData.streams_last_month
          ? parseInt(formData.streams_last_month)
          : 0,
        track_count: formData.track_count ? parseInt(formData.track_count) : 0,
        genres: genresArray,
        country: formData.country || null,
        is_contactable: !!formData.email,
      }

      const res = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create artist')
      }

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        instagram_url: '',
        website: '',
        spotify_url: '',
        spotify_monthly_listeners: '',
        streams_last_month: '',
        track_count: '',
        genres: '',
        country: '',
      })
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create artist')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Artist</DialogTitle>
          <DialogDescription>
            Enter artist details to add them to your database
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">
                  Artist Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Drake"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="artist@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram URL</Label>
                <Input
                  id="instagram"
                  type="url"
                  placeholder="https://instagram.com/poolside"
                  value={formData.instagram_url}
                  onChange={(e) =>
                    setFormData({ ...formData, instagram_url: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="spotify">Spotify URL</Label>
                <Input
                  id="spotify"
                  type="url"
                  placeholder="https://open.spotify.com/artist/..."
                  value={formData.spotify_url}
                  onChange={(e) =>
                    setFormData({ ...formData, spotify_url: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listeners">Monthly Listeners</Label>
                <Input
                  id="listeners"
                  type="number"
                  placeholder="85000000"
                  value={formData.spotify_monthly_listeners}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spotify_monthly_listeners: e.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="streams">Streams Last Month</Label>
                <Input
                  id="streams"
                  type="number"
                  placeholder="500000000"
                  value={formData.streams_last_month}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      streams_last_month: e.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracks">Track Count</Label>
                <Input
                  id="tracks"
                  type="number"
                  placeholder="250"
                  value={formData.track_count}
                  onChange={(e) =>
                    setFormData({ ...formData, track_count: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="US"
                  maxLength={2}
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value.toUpperCase() })
                  }
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">2-letter code (e.g., US, CA, UK)</p>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="genres">Genres</Label>
                <Input
                  id="genres"
                  placeholder="hip-hop, rap, trap"
                  value={formData.genres}
                  onChange={(e) =>
                    setFormData({ ...formData, genres: e.target.value })
                  }
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Artist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
