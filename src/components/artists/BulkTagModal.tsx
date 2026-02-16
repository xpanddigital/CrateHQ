'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { TagBadge } from '@/components/shared/TagBadge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Tag } from '@/types/database'

interface BulkTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  artistIds: string[]
  onComplete: () => void
}

export function BulkTagModal({ open, onOpenChange, artistIds, onComplete }: BulkTagModalProps) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTags()
    }
  }, [open])

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (data.tags) {
        setAllTags(data.tags)
      }
    } catch (error) {
      console.error('Error fetching tags:', error)
    }
  }

  const handleToggleTag = (tagId: string) => {
    const newSelected = new Set(selectedTagIds)
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId)
    } else {
      newSelected.add(tagId)
    }
    setSelectedTagIds(newSelected)
  }

  const handleApply = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/artists/bulk-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistIds,
          tagIds: Array.from(selectedTagIds),
        }),
      })

      if (!res.ok) throw new Error('Failed to apply tags')

      setSelectedTagIds(new Set())
      onOpenChange(false)
      onComplete()
    } catch (error) {
      console.error('Error applying tags:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Tags to {artistIds.length} Artists</DialogTitle>
          <DialogDescription>
            Select tags to add to the selected artists
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto py-4">
          {allTags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags available. Create tags first.
            </p>
          ) : (
            allTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                onClick={() => handleToggleTag(tag.id)}
              >
                <Checkbox
                  checked={selectedTagIds.has(tag.id)}
                  onCheckedChange={() => handleToggleTag(tag.id)}
                />
                <TagBadge tag={tag} />
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={loading || selectedTagIds.size === 0}>
            {loading ? 'Applying...' : `Apply to ${artistIds.length} Artists`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
