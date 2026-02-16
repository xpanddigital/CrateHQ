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
import { Plus, X } from 'lucide-react'
import { Tag } from '@/types/database'

interface TagManagerProps {
  artistId: string
  currentTags: Tag[]
  onTagsUpdated: () => void
}

export function TagManager({ artistId, currentTags, onTagsUpdated }: TagManagerProps) {
  const [open, setOpen] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTags()
      setSelectedTagIds(new Set(currentTags.map(t => t.id)))
    }
  }, [open, currentTags])

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

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/artists/${artistId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: Array.from(selectedTagIds) }),
      })

      if (!res.ok) throw new Error('Failed to update tags')

      setOpen(false)
      onTagsUpdated()
    } catch (error) {
      console.error('Error updating tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    try {
      const newTagIds = currentTags.filter(t => t.id !== tagId).map(t => t.id)
      const res = await fetch(`/api/artists/${artistId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: newTagIds }),
      })

      if (!res.ok) throw new Error('Failed to remove tag')
      onTagsUpdated()
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        {currentTags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Tag
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Select tags to apply to this artist
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
