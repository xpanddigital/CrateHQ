'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { TagBadge } from '@/components/shared/TagBadge'
import { Plus, Search, Upload, Users, CheckCircle, XCircle } from 'lucide-react'
import { Artist } from '@/types/database'
import { formatNumber, formatDate } from '@/lib/utils'
import { ArtistAddModal } from '@/components/artists/ArtistAddModal'
import { BulkTagModal } from '@/components/artists/BulkTagModal'
import { BulkEnrichModal } from '@/components/artists/BulkEnrichModal'

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkTagModal, setShowBulkTagModal] = useState(false)
  const [showBulkEnrichModal, setShowBulkEnrichModal] = useState(false)

  const fetchArtists = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...(search && { search }),
      })

      const res = await fetch(`/api/artists?${params}`)
      const data = await res.json()

      if (data.artists) {
        setArtists(data.artists)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching artists:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === artists.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(artists.map(a => a.id)))
    }
  }

  if (loading && artists.length === 0) {
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
          <h1 className="text-3xl font-bold">Artists</h1>
          <p className="text-muted-foreground">
            Manage your artist database and enrichment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/artists/import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Link>
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Artist
          </Button>
        </div>
      </div>

      <ArtistAddModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />

      <BulkTagModal
        open={showBulkTagModal}
        onOpenChange={setShowBulkTagModal}
        artistIds={Array.from(selectedIds)}
        onComplete={() => {
          setSelectedIds(new Set())
          fetchArtists()
        }}
      />

      <BulkEnrichModal
        open={showBulkEnrichModal}
        onOpenChange={setShowBulkEnrichModal}
        artistIds={Array.from(selectedIds)}
        onComplete={() => {
          setSelectedIds(new Set())
          fetchArtists()
        }}
      />

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artists..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkTagModal(true)}
              >
                Tag ({selectedIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkEnrichModal(true)}
              >
                Enrich ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>
      </Card>

      {artists.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No artists yet"
          description="Get started by adding artists manually or importing from CSV"
          action={{
            label: 'Add Artist',
            onClick: () => {},
          }}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === artists.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Streams</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artists.map((artist) => (
                <TableRow key={artist.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(artist.id)}
                      onCheckedChange={() => toggleSelect(artist.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/artists/${artist.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {artist.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {formatNumber(artist.spotify_monthly_listeners)}
                  </TableCell>
                  <TableCell>
                    {artist.email ? (
                      <span className="text-sm">{artist.email}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {artist.is_contactable ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Contactable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" />
                          No Email
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {artist.tags?.slice(0, 2).map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                      {artist.tags && artist.tags.length > 2 && (
                        <Badge variant="outline">+{artist.tags.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(artist.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/artists/${artist.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
